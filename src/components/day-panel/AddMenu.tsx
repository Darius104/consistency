import { useEffect, useRef, useState } from "react";
import type { Template } from "../../types";
import { Button } from "../ui/Button";
import {
  BookmarkIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  NoteIcon,
} from "../ui/icons";
import "./AddMenu.css";

interface AddMenuProps {
  templates: Template[];
  onAddTask: () => void;
  onApplyTemplate: (templateId: string) => void;
  onAddNote: () => void;
}

// Replaces what used to be two separate header buttons (a "+ Template"
// dropdown and a "+ Add task" button) with one "+" button that opens a
// small menu - "add task" / "use a template" / "add note" - so picking a
// template is a second step inside that same menu rather than its own
// permanently-visible button.
export function AddMenu({ templates, onAddTask, onApplyTemplate, onAddNote }: AddMenuProps) {
  const [open, setOpen] = useState(false);
  const [showingTemplates, setShowingTemplates] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Pointer, not mouse - on touch, compat mouse events fire ~300ms after
    // (or sometimes not at all for a touch that moved, e.g. into a scroll)
    // touchend, so a tap/scroll starting on a row underneath this popup
    // could land before "mousedown" ever fired here, leaving the popup open
    // and its own (opaque, higher-stacked) DOM still there to swallow that
    // same touch - looking exactly like "tapping/scrolling a row sometimes
    // does nothing" right after opening this menu.
    function onOutside(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener("pointerdown", onOutside);
    return () => document.removeEventListener("pointerdown", onOutside);
  }, [open]);

  function close() {
    setOpen(false);
    // Reset back to the main menu only after the close animation would have
    // settled, so re-opening never flashes the template list first.
    window.setTimeout(() => setShowingTemplates(false), 200);
  }

  return (
    <div className="add-menu" ref={rootRef}>
      <Button variant="primary" onClick={() => setOpen((v) => !v)}>
        + Add
      </Button>
      {open && (
        <div className="add-menu__popup">
          {showingTemplates ? (
            <>
              <button
                type="button"
                className="add-menu__option add-menu__option--back"
                onClick={() => setShowingTemplates(false)}
              >
                <ChevronLeftIcon size={13} />
                Back
              </button>
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="add-menu__option"
                  onClick={() => {
                    onApplyTemplate(t.id);
                    close();
                  }}
                >
                  <span className="add-menu__option-name">{t.name}</span>
                  <span className="add-menu__option-meta">
                    {t.taskCount} {t.taskCount === 1 ? "task" : "tasks"}
                  </span>
                </button>
              ))}
            </>
          ) : (
            <>
              <button
                type="button"
                className="add-menu__option"
                onClick={() => {
                  onAddTask();
                  close();
                }}
              >
                <CheckIcon size={14} className="add-menu__option-icon" />
                <span className="add-menu__option-name">Add task</span>
              </button>
              {templates.length > 0 && (
                <button
                  type="button"
                  className="add-menu__option"
                  onClick={() => setShowingTemplates(true)}
                >
                  <BookmarkIcon size={14} className="add-menu__option-icon" />
                  <span className="add-menu__option-name">Use a template</span>
                  <ChevronRightIcon size={13} className="add-menu__option-chevron" />
                </button>
              )}
              <button
                type="button"
                className="add-menu__option"
                onClick={() => {
                  onAddNote();
                  close();
                }}
              >
                <NoteIcon size={14} className="add-menu__option-icon" />
                <span className="add-menu__option-name">Add note</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
