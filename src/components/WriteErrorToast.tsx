import { useEffect, useState } from "react";
import { XIcon } from "./ui/icons";
import "./WriteErrorToast.css";

const AUTO_HIDE_MS = 6000;

/**
 * A single global safety net for the app's optimistic local writes
 * (toggling a task, freezing a day, saving a task, ...). None of those
 * handlers are awaited by their own callers - they're plain event-handler
 * props - so a thrown error inside one becomes a genuine unhandled promise
 * rejection instead of silently vanishing. Without this, a failed local
 * write (a full disk, a locked/corrupted cache file, anything) left the
 * UI's already-applied optimistic state with no indication it never
 * actually persisted.
 *
 * This deliberately doesn't roll anything back - the app has 25+ different
 * optimistic-write handlers, each with its own state shape, and correctly
 * unwinding each one individually is a much larger, riskier change than
 * just making a real failure visible instead of silent, which is the
 * actual gap this closes.
 */
export function WriteErrorToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    function handleRejection(event: PromiseRejectionEvent) {
      console.error("[app] unhandled promise rejection", event.reason);
      setMessage("Something didn't save - please try that again.");
    }
    window.addEventListener("unhandledrejection", handleRejection);
    return () => window.removeEventListener("unhandledrejection", handleRejection);
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), AUTO_HIDE_MS);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!message) return null;

  return (
    <div className="write-error-toast" role="alert">
      <span>{message}</span>
      <button
        type="button"
        className="write-error-toast__dismiss"
        onClick={() => setMessage(null)}
        aria-label="Dismiss"
      >
        <XIcon size={13} />
      </button>
    </div>
  );
}
