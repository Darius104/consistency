import { useEffect } from "react";
import "./TaskDeletedToast.css";

interface TaskDeletedToastProps {
  taskTitle: string;
  /** What just happened to it - "Deleted" (default) or "Completed". */
  verb?: string;
  onUndo: () => void;
  onDismiss: () => void;
}

const AUTO_HIDE_MS = 5000;

/** Desktop's safety net for skipping the confirmation modal on delete (see
 *  App.tsx's handleRequestDeleteTask) - mobile keeps ConfirmModal instead,
 *  since a touch delete is more likely to be an accidental swipe/tap than
 *  a deliberate desktop click on the small trash icon. */
export function TaskDeletedToast({ taskTitle, verb = "Deleted", onUndo, onDismiss }: TaskDeletedToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, AUTO_HIDE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="task-deleted-toast" role="status">
      <span className="task-deleted-toast__text">
        {verb} <strong>{taskTitle}</strong>
      </span>
      <button type="button" className="task-deleted-toast__undo" onClick={onUndo}>
        Undo
      </button>
    </div>
  );
}
