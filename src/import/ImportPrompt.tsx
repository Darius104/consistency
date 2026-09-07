import { useState } from "react";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { importLegacyData, type LegacyPeek } from "./importLegacyData";
import "./ImportPrompt.css";

interface ImportPromptProps {
  counts: LegacyPeek["counts"];
  /** Called once the import has actually finished successfully. */
  onDone: () => void;
  onSkip: () => void;
}

export function ImportPrompt({ counts, onDone, onSkip }: ImportPromptProps) {
  const [status, setStatus] = useState<"idle" | "importing" | "error">("idle");
  const [step, setStep] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    setStatus("importing");
    setError(null);
    try {
      await importLegacyData((s) => setStep(s));
      onDone();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  const importing = status === "importing";

  return (
    <Modal title="Import your existing data" onClose={onSkip}>
      <div className="import-prompt">
        <p className="import-prompt__body">
          We found tasks on this device from before you signed in. Bring them into your account?
        </p>

        <div className="import-prompt__counts">
          <div className="import-prompt__count">
            <span className="import-prompt__count-value">{counts.tags}</span>
            <span className="import-prompt__count-label">categories</span>
          </div>
          <div className="import-prompt__count">
            <span className="import-prompt__count-value">{counts.tasks}</span>
            <span className="import-prompt__count-label">tasks</span>
          </div>
          <div className="import-prompt__count">
            <span className="import-prompt__count-value">{counts.completions}</span>
            <span className="import-prompt__count-label">completions</span>
          </div>
        </div>

        {importing && <p className="import-prompt__step">{step}</p>}
        {error && <p className="import-prompt__error">{error}</p>}

        <div className="import-prompt__actions">
          <Button onClick={onSkip} disabled={importing}>
            Skip
          </Button>
          <Button variant="primary" onClick={handleImport} disabled={importing}>
            {importing ? "Importing…" : status === "error" ? "Try again" : "Import my data"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
