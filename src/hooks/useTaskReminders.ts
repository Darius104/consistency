import { useEffect, useRef } from "react";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import type { Task } from "../types";
import { todayKey } from "../utils/dates";
import { tasksScheduledOn } from "../utils/recurrence";

const CHECK_INTERVAL_MS = 30 * 1000;

function currentHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Fires a native notification the minute a scheduled task's time arrives,
 * as long as this hook is mounted (i.e. the app is running) and the task
 * isn't already completed. Only fires once per task per day - reopening the
 * app after its time already passed does not "catch up" on missed ones.
 */
export function useTaskReminders(
  tasks: Task[],
  completions: Set<string>,
  enabled: boolean,
) {
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function ensurePermission(): Promise<boolean> {
      let granted = await isPermissionGranted();
      if (!granted) {
        const result = await requestPermission();
        granted = result === "granted";
      }
      return granted;
    }

    async function check() {
      const granted = await ensurePermission();
      if (!granted || cancelled) return;

      const today = todayKey();
      const nowHHMM = currentHHMM();
      const due = tasksScheduledOn(tasks, today).filter((t) => t.time === nowHHMM);

      for (const task of due) {
        const notifiedKey = `${task.id}:${today}`;
        if (notifiedRef.current.has(notifiedKey)) continue;
        if (completions.has(`${task.id}:${today}`)) continue;

        notifiedRef.current.add(notifiedKey);
        sendNotification({
          title: task.title,
          body: task.notes || "It's time for this task.",
          sound: "default",
        });
      }
    }

    void check();
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [tasks, completions, enabled]);
}
