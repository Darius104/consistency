import { supabase } from "../lib/supabaseClient";
import type { Priority, RecurrenceType, Tag, Task, ThemeId } from "../types";
import { DEFAULT_AVATAR_ID, parseAvatarId, type AvatarId } from "../utils/avatars";
import {
  parseHiddenWidgets,
  parsePanelOrder,
  type PanelBlockId,
  type WidgetId,
} from "../utils/panelOrder";
import type { RandomThemeColors } from "../utils/randomTheme";
import { DEFAULT_THEME } from "../utils/themes";

// Everything here talks to Supabase directly, unlike queries.ts (which only
// ever touches the local offline cache). Friend data is deliberately
// online-only - see supabase/friends_schema.sql for why it isn't safe to
// fold into the existing cache/sync layer.

export interface Friend {
  userId: string;
  displayName: string;
  avatarId: AvatarId;
  /** Null if they've never been recorded online (or the column predates
   *  them). Live online/offline itself comes from usePresence, not this -
   *  this is only ever shown as "last seen X ago" for an offline friend. */
  lastSeenAt: string | null;
}

export interface FriendCode {
  code: string;
  expiresAt: string;
}

export interface MyProfile {
  displayName: string;
  bio: string | null;
  avatarId: AvatarId;
}

export type MembershipTier = "free" | "premium" | "admin";

export interface Member {
  userId: string;
  displayName: string;
  tier: MembershipTier;
  avatarId: AvatarId;
  bio: string | null;
}

export interface FriendCalendarData {
  tasks: Task[];
  tags: Tag[];
  completions: Set<string>;
  freezes: Set<string>;
  theme: ThemeId;
  randomColors: RandomThemeColors | null;
  displayName: string;
  bio: string | null;
  avatarId: AvatarId;
  /** The friend's own widget arrangement/visibility choices, so their
   *  calendar shows the same widgets they've kept visible, in their order -
   *  parsed with the exact same fallback rules as your own (see
   *  parsePanelOrder/parseHiddenWidgets), since a friend who never touched
   *  these settings has the same null-from-the-database shape you would. */
  panelOrder: PanelBlockId[];
  hiddenWidgets: WidgetId[];
}

async function currentUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return user.id;
}

/** Creates a profile row (default display name from the email's local-part)
 *  the first time this account is ever seen - a no-op every time after,
 *  since it must never clobber a name the user has since customized. */
export async function ensureProfile(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const defaultName = (user.email ?? "friend").split("@")[0];
  const { error } = await supabase
    .from("profiles")
    .upsert(
      { user_id: user.id, display_name: defaultName },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  if (error) throw new Error(error.message);
}

/** Called once, right after a successful signUp() - not ignoreDuplicates
 *  like ensureProfile above, since this needs to actually land regardless
 *  of whether ensureProfile's own upsert (also triggered by the same new
 *  session, from App.tsx) happens to create the row first. Re-affirming
 *  the same default display name either way is harmless - this only ever
 *  runs once, for a brand-new account that hasn't customized anything yet. */
export async function recordTermsAcceptance(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const defaultName = (user.email ?? "friend").split("@")[0];
  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: user.id,
      display_name: defaultName,
      terms_accepted_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
}

/** Deletes the account and everything it owns - see delete_my_account() in
 *  supabase/account_deletion_schema.sql for exactly what that covers. There
 *  is no undo; the caller is expected to have already confirmed with the
 *  user before calling this. */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw new Error(error.message);
}

export async function updateDisplayName(name: string): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: name })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function getMyProfile(): Promise<MyProfile> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, bio, avatar_id")
    .eq("user_id", userId)
    .single();
  if (error) throw new Error(error.message);
  const row = data as {
    display_name: string;
    bio: string | null;
    avatar_id: string | null;
  };
  return {
    displayName: row.display_name,
    bio: row.bio,
    avatarId: parseAvatarId(row.avatar_id),
  };
}

/** Read-only - there's no self-service billing yet, so this is set by hand
 *  in the Supabase dashboard (see supabase/membership_schema.sql). The
 *  "update own profile" RLS policy can't write this column even if some
 *  future code accidentally tried to. */
export async function getMyMembership(): Promise<MembershipTier> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("profiles")
    .select("membership_tier")
    .eq("user_id", userId)
    .single();
  if (error) throw new Error(error.message);
  const row = data as { membership_tier: MembershipTier };
  return row.membership_tier;
}

/** Admin-only in practice: the "admins can select all profiles" RLS policy
 *  (see supabase/membership_admin_schema.sql) means a non-admin calling
 *  this just gets back their own row (same as getMyMembership), not an
 *  error - so this is safe to call, but only actually useful for admins. */
export async function listAllMembers(): Promise<Member[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, display_name, membership_tier, avatar_id, bio")
    .order("display_name");
  if (error) throw new Error(error.message);
  const rows = data as {
    user_id: string;
    display_name: string;
    membership_tier: MembershipTier;
    avatar_id: string | null;
    bio: string | null;
  }[];
  return rows.map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    tier: row.membership_tier,
    avatarId: parseAvatarId(row.avatar_id),
    bio: row.bio,
  }));
}

/** Calls a SECURITY DEFINER function that re-checks admin status itself
 *  server-side and only ever accepts "free"/"premium" - see
 *  admin_set_membership_tier() in supabase/membership_admin_schema.sql. */
export async function setMemberTier(userId: string, tier: "free" | "premium"): Promise<void> {
  const { error } = await supabase.rpc("admin_set_membership_tier", {
    target_user_id: userId,
    new_tier: tier,
  });
  if (error) throw new Error(error.message);
}

export async function updateMyProfile(update: {
  bio: string | null;
  avatarId: AvatarId;
}): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase
    .from("profiles")
    .update({
      bio: update.bio,
      avatar_id: update.avatarId,
    })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/** Mirrors your current theme choice onto your profile row, so a friend
 *  viewing your calendar sees it in your colors, not theirs. Called both on
 *  every theme change and once per session load (covers accounts that
 *  picked a theme before this field existed). */
export async function syncMyThemeToProfile(
  theme: ThemeId,
  randomColors: RandomThemeColors | null,
): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase
    .from("profiles")
    .update({ theme, random_theme_colors: randomColors })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

// Uppercase alphanumeric, minus visually ambiguous characters (0/O, 1/I).
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const CODE_TTL_MS = 15 * 60 * 1000;

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

/** Regenerate semantics - only one active code per account at a time. */
export async function generateFriendCode(): Promise<FriendCode> {
  const userId = await currentUserId();
  await supabase.from("friend_codes").delete().eq("user_id", userId);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const { error } = await supabase
      .from("friend_codes")
      .insert({ code, user_id: userId, expires_at: expiresAt });
    if (!error) return { code, expiresAt };
    if (error.code !== "23505") throw new Error(error.message); // not a collision - real failure
  }
  throw new Error("Couldn't generate a unique code - try again.");
}

export async function redeemFriendCode(code: string): Promise<Friend> {
  const { data, error } = await supabase.rpc("redeem_friend_code", {
    p_code: code.trim().toUpperCase(),
  });
  if (error) throw new Error(error.message);
  const result = data as { user_id: string; display_name: string };
  // The RPC predates avatars and only ever returns user_id/display_name -
  // this just shows the default shape until the next listFriends() refresh
  // (FriendsManager already polls every 4s), rather than needing to touch
  // that already-applied SQL function for a cosmetic, self-correcting gap.
  return {
    userId: result.user_id,
    displayName: result.display_name,
    avatarId: DEFAULT_AVATAR_ID,
    lastSeenAt: null,
  };
}

export async function listFriends(): Promise<Friend[]> {
  const userId = await currentUserId();
  const [asA, asB] = await Promise.all([
    supabase.from("friendships").select("user_b").eq("user_a", userId),
    supabase.from("friendships").select("user_a").eq("user_b", userId),
  ]);
  if (asA.error) throw new Error(asA.error.message);
  if (asB.error) throw new Error(asB.error.message);

  const otherIds = [
    ...(asA.data ?? []).map((r) => r.user_b as string),
    ...(asB.data ?? []).map((r) => r.user_a as string),
  ];
  if (otherIds.length === 0) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, display_name, avatar_id, last_seen_at")
    .in("user_id", otherIds);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    userId: row.user_id as string,
    displayName: row.display_name as string,
    avatarId: parseAvatarId(row.avatar_id as string | null),
    lastSeenAt: row.last_seen_at as string | null,
  }));
}

/** Best-effort heartbeat, not the source of truth for "online now" (that's
 *  Realtime Presence - see usePresence.ts) - this only ever back-fills
 *  "last seen X ago" for whenever they're next viewed while offline. */
export async function touchLastSeen(): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function removeFriend(otherUserId: string): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase
    .from("friendships")
    .delete()
    .or(
      `and(user_a.eq.${userId},user_b.eq.${otherUserId}),and(user_a.eq.${otherUserId},user_b.eq.${userId})`,
    );
  if (error) throw new Error(error.message);
}

interface FriendTaskRow {
  id: string;
  title: string;
  notes: string | null;
  time: string | null;
  tag_id: string | null;
  priority: string;
  recurrence_type: string;
  recurrence_days: string | null;
  start_date: string;
  end_date: string | null;
  sort_order: number;
}

interface FriendTagRow {
  id: string;
  name: string;
  color: string;
  sort_order: number;
}

export async function fetchFriendCalendarData(friendUserId: string): Promise<FriendCalendarData> {
  const [{ data, error }, profileResult] = await Promise.all([
    supabase.rpc("get_friend_calendar_data", { p_friend_id: friendUserId }),
    supabase
      .from("profiles")
      .select("display_name, theme, random_theme_colors, bio, avatar_id")
      .eq("user_id", friendUserId)
      .single(),
  ]);
  if (error) throw new Error(error.message);
  if (profileResult.error) throw new Error(profileResult.error.message);

  const profile = profileResult.data as {
    display_name: string;
    theme: string | null;
    random_theme_colors: RandomThemeColors | null;
    bio: string | null;
    avatar_id: string | null;
  };

  const raw = data as {
    tasks: FriendTaskRow[];
    tags: FriendTagRow[];
    completions: { task_id: string; date: string }[];
    freezes: { date: string }[];
    panel_order: string | null;
    hidden_widgets: string | null;
  };

  const tasks: Task[] = raw.tasks.map((row) => ({
    id: row.id,
    title: row.title,
    notes: row.notes,
    time: row.time,
    tagId: row.tag_id,
    priority: row.priority as Priority,
    recurrenceType: row.recurrence_type as RecurrenceType,
    recurrenceDays: row.recurrence_days ? row.recurrence_days.split(",").map(Number) : null,
    startDate: row.start_date,
    endDate: row.end_date,
    sortOrder: row.sort_order,
  }));

  const tags: Tag[] = raw.tags.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order,
  }));

  const completions = new Set(raw.completions.map((c) => `${c.task_id}:${c.date}`));
  const freezes = new Set(raw.freezes.map((f) => f.date));

  return {
    tasks,
    tags,
    completions,
    freezes,
    theme: (profile.theme as ThemeId) ?? DEFAULT_THEME,
    randomColors: profile.random_theme_colors ?? null,
    displayName: profile.display_name,
    bio: profile.bio,
    avatarId: parseAvatarId(profile.avatar_id),
    panelOrder: parsePanelOrder(raw.panel_order),
    hiddenWidgets: parseHiddenWidgets(raw.hidden_widgets),
  };
}
