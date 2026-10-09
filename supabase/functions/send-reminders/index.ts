// Supabase Edge Function: send-reminders
//
// Called once a minute by pg_cron (see supabase/push_reminders_schema.sql).
// For every user with a registered phone (push_devices), works out "now" in
// that user's own time zone, finds what's due - each timed task scheduled
// for today whose time has just arrived, plus the 21:00 "day's almost over"
// nudge - skips anything already completed (on ANY device), and pushes the
// rest through Apple (APNs). sent_reminders makes sure nothing goes twice.
//
// This is what makes reminders respect ticks made on another device: the
// decision is made here, at send time, from the shared data - not by a
// schedule a phone set up hours earlier.
//
// Secrets (Supabase dashboard -> Edge Functions -> Secrets):
//   APNS_KEY_P8     contents of the AuthKey_XXXX.p8 file
//   APNS_KEY_ID     the key's 10-character Key ID
//   APNS_TEAM_ID    the Apple Developer Team ID
//   APNS_BUNDLE_ID  com.darius.consistency
//   CRON_SECRET     shared with the pg_cron job, so only it can call this
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from "jsr:@supabase/supabase-js@2";

const END_OF_DAY_TIME = "21:00";
// A run that's a little late (cron jitter, a slow previous run) still
// catches anything that came due within this window. sent_reminders stops
// the overlap from sending anything twice.
const CATCH_UP_MINUTES = 3;

interface Task {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  time: string | null;
  tag_id: string | null;
  recurrence_type: "none" | "daily" | "weekly";
  recurrence_days: number[] | null;
  start_date: string;
  end_date: string | null;
}

interface Device {
  token: string;
  user_id: string;
  environment: string;
  timezone: string;
  updated_at: string;
}

interface Due {
  userId: string;
  key: string;
  title: string;
  body: string;
}

// --- dates, in the user's own time zone -----------------------------------

function localNow(timezone: string): { date: string; minutes: number; weekday: number } {
  let tz = timezone;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    tz = "UTC";
  }
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    weekday: weekdays.indexOf(parts.weekday),
  };
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Same rules as the app's isTaskScheduledOn (src/utils/recurrence.ts). */
function isScheduledOn(task: Task, date: string, weekday: number): boolean {
  if (date < task.start_date) return false;
  if (task.end_date && date > task.end_date) return false;
  const days = task.recurrence_days ?? [];
  switch (task.recurrence_type) {
    case "none":
      return date === task.start_date;
    case "daily":
      return days.length === 0 || days.includes(weekday);
    case "weekly":
      return days.includes(weekday);
  }
  return false;
}

/** Came due in the last few minutes (and not later than now). */
function justDue(time: string, nowMinutes: number): boolean {
  const diff = nowMinutes - toMinutes(time);
  return diff >= 0 && diff < CATCH_UP_MINUTES;
}

// --- APNs -----------------------------------------------------------------

let cachedJwt: { token: string; at: number } | null = null;

function base64url(bytes: Uint8Array | string): string {
  const b = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** APNs auth token (ES256 JWT), reused for 50 minutes - Apple asks for
 *  one at most every 20 minutes and accepts it for an hour. */
async function apnsJwt(): Promise<string> {
  if (cachedJwt && Date.now() - cachedJwt.at < 50 * 60 * 1000) return cachedJwt.token;
  const pem = Deno.env.get("APNS_KEY_P8") ?? "";
  const der = Uint8Array.from(
    atob(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")),
    (c) => c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const header = base64url(JSON.stringify({ alg: "ES256", kid: Deno.env.get("APNS_KEY_ID") }));
  const claims = base64url(
    JSON.stringify({ iss: Deno.env.get("APNS_TEAM_ID"), iat: Math.floor(Date.now() / 1000) }),
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      new TextEncoder().encode(`${header}.${claims}`),
    ),
  );
  const token = `${header}.${claims}.${base64url(signature)}`;
  cachedJwt = { token, at: Date.now() };
  return token;
}

/** Sends one notification. Returns false when Apple says the token is dead
 *  (app deleted, token rotated) so the device can be forgotten. */
async function sendPush(device: Device, title: string, body: string): Promise<boolean> {
  const host =
    device.environment === "sandbox" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
  const res = await fetch(`https://${host}/3/device/${device.token}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${await apnsJwt()}`,
      "apns-topic": Deno.env.get("APNS_BUNDLE_ID") ?? "com.darius.consistency",
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    // The app's own sound, bundled in the iPhone app (iOS falls back to
    // the default sound if a phone has an older build without it).
    body: JSON.stringify({ aps: { alert: { title, body }, sound: "consistency_reminder.caf" } }),
  });
  if (res.ok) return true;
  const reason = await res.text();
  console.error(`[apns] ${res.status} ${reason} (${device.environment})`);
  return !(res.status === 410 || reason.includes("BadDeviceToken") || reason.includes("Unregistered"));
}

// --- the run --------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
    return new Response("forbidden", { status: 403 });
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: devices, error: devErr } = await db.from("push_devices").select("*");
  if (devErr) return new Response(devErr.message, { status: 500 });
  if (!devices?.length) return new Response("no devices");

  const byUser = new Map<string, Device[]>();
  for (const d of devices as Device[]) {
    const list = byUser.get(d.user_id) ?? [];
    list.push(d);
    byUser.set(d.user_id, list);
  }
  const userIds = [...byUser.keys()];

  // Only users who have reminders switched on.
  const { data: settings } = await db
    .from("settings")
    .select("user_id, value")
    .eq("key", "remindersEnabled")
    .in("user_id", userIds);
  const enabled = new Set((settings ?? []).filter((s) => s.value === "true").map((s) => s.user_id));
  const activeUsers = userIds.filter((u) => enabled.has(u));
  if (activeUsers.length === 0) return new Response("nobody enabled");

  // "Now" per user, from their most recently updated device's time zone.
  const now = new Map<string, ReturnType<typeof localNow>>();
  for (const u of activeUsers) {
    const latest = byUser.get(u)!.sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
    now.set(u, localNow(latest.timezone));
  }
  const dates = [...new Set([...now.values()].map((n) => n.date))];

  const [{ data: tasks }, { data: freezes }, { data: tags }] = await Promise.all([
    db
      .from("tasks")
      .select(
        "id, user_id, title, notes, time, tag_id, recurrence_type, recurrence_days, start_date, end_date",
      )
      .in("user_id", activeUsers),
    db.from("streak_freezes").select("user_id, date").in("user_id", activeUsers).in("date", dates),
    db.from("tags").select("id, name").in("user_id", activeUsers),
  ]);
  // Ticks for these users' tasks on today's date(s) - looked up by task, so
  // it doesn't matter which device (or user column) wrote them.
  const taskIds = (tasks ?? []).map((t) => t.id);
  const { data: completions } = taskIds.length
    ? await db.from("task_completions").select("task_id, date").in("task_id", taskIds).in("date", dates)
    : { data: [] as { task_id: string; date: string }[] };

  const done = new Set((completions ?? []).map((c) => `${c.task_id}:${c.date}`));
  const frozen = new Set((freezes ?? []).map((f) => `${f.user_id}:${f.date}`));
  const tagName = new Map((tags ?? []).map((t) => [t.id, t.name]));

  const due: Due[] = [];
  for (const u of activeUsers) {
    const n = now.get(u)!;
    const todays = (tasks as Task[] | null ?? []).filter(
      (t) => t.user_id === u && isScheduledOn(t, n.date, n.weekday),
    );

    for (const t of todays) {
      if (!t.time || !justDue(t.time, n.minutes)) continue;
      if (done.has(`${t.id}:${n.date}`)) continue;
      const group = t.tag_id ? tagName.get(t.tag_id) : undefined;
      due.push({
        userId: u,
        // Includes the time: moving a task to a later time today (on any
        // device) makes it a new reminder, rather than "already sent today".
        key: `${t.id}:${n.date}:${t.time}`,
        title: group ? `${group} · ${t.title}` : t.title,
        body: t.notes || `Scheduled for ${t.time}`,
      });
    }

    if (justDue(END_OF_DAY_TIME, n.minutes) && !frozen.has(`${u}:${n.date}`)) {
      const left = todays.filter((t) => !done.has(`${t.id}:${n.date}`)).length;
      if (todays.length > 0 && left > 0) {
        due.push({
          userId: u,
          key: `eod:${n.date}`,
          title: "Day's almost over",
          body: `${left} ${left === 1 ? "task" : "tasks"} left today to keep the streak alive.`,
        });
      }
    }
  }

  let sent = 0;
  for (const d of due) {
    // Claim it first - if this row already exists, an earlier (or
    // overlapping) run sent it.
    const { data: claimed } = await db
      .from("sent_reminders")
      .upsert({ user_id: d.userId, key: d.key }, { onConflict: "user_id,key", ignoreDuplicates: true })
      .select("key");
    if (!claimed?.length) continue;

    for (const device of byUser.get(d.userId)!) {
      const alive = await sendPush(device, d.title, d.body);
      if (alive) sent++;
      else await db.from("push_devices").delete().eq("token", device.token);
    }
  }

  // Housekeeping: sent_reminders only needs the last couple of days.
  await db.from("sent_reminders").delete().lt("sent_at", new Date(Date.now() - 3 * 86400000).toISOString());

  return new Response(JSON.stringify({ due: due.length, sent }), {
    headers: { "content-type": "application/json" },
  });
});
