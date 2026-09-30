import { useEffect, useRef, useState } from "react";
import { getTemplateTasks } from "../../db/queries";
import type { Template, TemplateTaskBlueprint } from "../../types";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { Skeleton } from "../ui/Skeleton";
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
  onApplyTemplate: (templateId: string, taskIndices: number[]) => void;
  onAddNote: () => void;
  /** True once the viewed day is already over - adding a task (or applying
   *  a template, which adds several at once) to a day that's already
   *  passed would create an incomplete task nothing can ever mark done,
   *  the same streak-integrity gap as editing one that's already there. */
  disabled?: boolean;
}

type Step = "main" | "templates" | "review";

// Replaces what used to be two separate header buttons (a "+ Template"
// dropdown and a "+ Add task" button) with one "+" button that opens a
// small menu - "add task" / "use a template" / "add note" - so picking a
// template is a second step inside that same menu rather than its own
// permanently-visible button. Picking a template itself is a third step
// (review) - stamping a template always used to add every one of its
// starter tasks; this lets you uncheck the ones you don't want today
// before adding just the rest.
export function AddMenu({
  templates,
  onAddTask,
  onApplyTemplate,
  onAddNote,
  disabled = false,
}: AddMenuProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("main");
  const [reviewingTemplate, setReviewingTemplate] = useState<Template | null>(null);
  const [reviewTasks, setReviewTasks] = useState<TemplateTaskBlueprint[]>([]);
  const [reviewTasksLoading, setReviewTasksLoading] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);
  // Guards against a slow getTemplateTasks() call for one template landing
  // after the user has already picked a different one (or closed the menu).
  const reviewRequestRef = useRef(0);

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

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function close() {
    setOpen(false);
    // Reset back to the main menu only after the close animation would have
    // settled, so re-opening never flashes the template list first.
    window.setTimeout(() => {
      setStep("main");
      setReviewingTemplate(null);
    }, 200);
  }

  function openTemplateReview(template: Template) {
    setReviewingTemplate(template);
    setStep("review");
    setReviewTasksLoading(true);
    setReviewTasks([]);
    const requestId = ++reviewRequestRef.current;
    getTemplateTasks(template.id).then((result) => {
      if (reviewRequestRef.current !== requestId) return;
      setReviewTasks(result);
      // Everything starts checked - unchecking is the opt-out, matching
      // what applying a template always used to do (add all of them).
      setSelectedIndices(new Set(result.map((_, i) => i)));
      setReviewTasksLoading(false);
    });
  }

  function toggleTask(index: number) {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function confirmReview() {
    if (!reviewingTemplate || selectedIndices.size === 0) return;
    onApplyTemplate(reviewingTemplate.id, [...selectedIndices].sort((a, b) => a - b));
    close();
  }

  return (
    <div className="add-menu" ref={rootRef}>
      <Button
        variant="primary"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="true"
        aria-expanded={open}
      >
        + Add
      </Button>
      {open && (
        <div className={`add-menu__popup ${step === "review" ? "add-menu__popup--wide" : ""}`}>
          {step === "review" && reviewingTemplate ? (
            <>
              <button
                type="button"
                className="add-menu__option add-menu__option--back"
                onClick={() => setStep("templates")}
              >
                <ChevronLeftIcon size={13} />
                Back
              </button>
              <span className="add-menu__review-title">{reviewingTemplate.name}</span>
              {reviewTasksLoading ? (
                <div className="add-menu__review-list">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} height={28} radius="var(--radius-sm)" />
                  ))}
                </div>
              ) : (
                <div className="add-menu__review-list">
                  {reviewTasks.map((t, i) => (
                    <Checkbox
                      key={i}
                      checked={selectedIndices.has(i)}
                      onChange={() => toggleTask(i)}
                      label={t.title}
                      ariaLabel={t.title}
                    />
                  ))}
                </div>
              )}
              <Button
                variant="primary"
                className="add-menu__review-confirm"
                onClick={confirmReview}
                disabled={reviewTasksLoading || selectedIndices.size === 0}
              >
                Add {selectedIndices.size > 0 ? selectedIndices.size : ""}{" "}
                {selectedIndices.size === 1 ? "task" : "tasks"}
              </Button>
            </>
          ) : step === "templates" ? (
            <>
              <button
                type="button"
                className="add-menu__option add-menu__option--back"
                onClick={() => setStep("main")}
              >
                <ChevronLeftIcon size={13} />
                Back
              </button>
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="add-menu__option"
                  onClick={() => openTemplateReview(t)}
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
                  onClick={() => setStep("templates")}
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
