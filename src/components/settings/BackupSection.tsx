import { useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { backupDatabase } from "../../db/queries";
import { todayKey } from "../../utils/dates";
import { Button } from "../ui/Button";
import "./BackupSection.css";

type Status = { kind: "idle" } | { kind: "success"; path: string } | { kind: "error"; message: string };

export function BackupSection() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setStatus({ kind: "idle" });
    const destination = await save({
      title: "Save Backup",
      defaultPath: `Consistency Backup ${todayKey()}.db`,
      filters: [{ name: "SQLite Database", extensions: ["db"] }],
    });
    if (!destination) return;

    setSaving(true);
    try {
      await backupDatabase(destination);
      setStatus({ kind: "success", path: destination });
    } catch (err) {
      setStatus({
        kind: "error",
        message:
          err instanceof Error
            ? err.message
            : "Couldn't save the backup - if a file already exists at that path, pick a different name.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="backup-section">
      <div className="settings__row">
        <span className="settings__row-text">
          Save a complete copy of your tasks, tags, and history to a file
        </span>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Backup…"}
        </Button>
      </div>

      {status.kind === "success" && (
        <span className="backup-section__status backup-section__status--success">
          Saved to {status.path}
        </span>
      )}
      {status.kind === "error" && (
        <span className="backup-section__status backup-section__status--error">
          {status.message}
        </span>
      )}

      <span className="settings__hint">
        To restore, quit the app, replace the file at "~/Library/Application
        Support/com.darius.consistency/app.db" with your backup, then reopen.
      </span>
    </div>
  );
}
