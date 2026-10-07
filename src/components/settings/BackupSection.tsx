import { useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { exportAllData } from "../../db/queries";
import { todayKey } from "../../utils/dates";

type Status = { kind: "idle" } | { kind: "success"; path: string } | { kind: "error"; message: string };

export function BackupSection() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setStatus({ kind: "idle" });
    const destination = await save({
      title: "Export Data",
      defaultPath: `Consistency Export ${todayKey()}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!destination) return;

    setSaving(true);
    try {
      const data = await exportAllData();
      await writeTextFile(destination, JSON.stringify(data, null, 2));
      setStatus({ kind: "success", path: destination });
    } catch (err) {
      setStatus({
        kind: "error",
        message:
          err instanceof Error
            ? err.message
            : "Couldn't export your data - if a file already exists at that path, pick a different name.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-group-wrap">
      <span className="settings-group__title">Your data</span>
      <div className="settings-group">
        <button type="button" className="settings-group__row" onClick={handleSave} disabled={saving}>
          <span className="settings-group__label">Export data</span>
          <span className="settings-group__value">{saving ? "Exporting…" : ""}</span>
        </button>
      </div>
      {status.kind === "success" && (
        <span className="settings-footnote settings-footnote--success">Saved to {status.path}</span>
      )}
      {status.kind === "error" && (
        <span className="settings-footnote settings-footnote--warning">{status.message}</span>
      )}
      <span className="settings-footnote">
        A readable copy of your tasks, templates and history. Your data itself is safe in your account.
      </span>
    </div>
  );
}
