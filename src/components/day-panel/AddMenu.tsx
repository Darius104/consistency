import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import { getTemplateTasks } from "../../db/queries";
import type { Tag, Template, TemplateTaskBlueprint } from "../../types";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { Modal } from "../ui/Modal";
import { Skeleton } from "../ui/Skeleton";
import {
  BookmarkIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  NoteIcon,
  TrendingUpIcon,
} from "../ui/icons";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { formatDayName } from "../../utils/dates";
import { ADD_COLORS, inkOn } from "./addKinds";
import "./AddMenu.css";

interface AddMenuProps {
  templates: Template[];
  /** For each template's color (its template group's). */
  tags: Tag[];
  onAddTask: () => void;
  onApplyTemplate: (templateId: string, taskIndices: number[]) => void;
  onAddNote: () => void;
  /** True once the viewed day is already over - adding a task (or applying
   *  a template, which adds several at once) to a day that's already
   *  passed would create an incomplete task nothing can ever mark done,
   *  the same streak-integrity gap as editing one that's already there. */
  disabled?: boolean;
  /** Bumped by the phone tab bar's "+" button to open this menu from
   *  outside - a counter rather than a boolean so the same request can be
   *  made again after the menu's been closed. */
  openRequest?: number;
  /** Called once a request has opened the menu, so the owner can clear it -
   *  otherwise remounting this (e.g. coming back from a friend's calendar)
   *  would see the old request and pop the menu open by itself. */
  onOpenRequestHandled?: () => void;
  /** The day new things get added to - named in the phone sheet's title. */
  dateKey: string;
  /** Phone sheet only: open the day's trading result (on desktop it has
   *  its own button right next to "+ Add"). */
  onLogResult?: () => void;
  hasResult?: boolean;
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
interface AddOption {
  id: string;
  color: string;
  icon: ReactNode;
  name: string;
  /** Under the name - on the phone tiles. */
  sub: string;
  /** Desktop dropdown's shorter line, when it differs. */
  deskSub?: string;
  /** Desktop: the keyboard shortcut that does the same thing. */
  kbd?: string;
  /** Opens a second level (the template list). */
  more?: boolean;
  run: () => void;
}

/** The color (and a readable icon color on it) as CSS variables, for the
 *  icon square / tile. */
function kind(color: string): CSSProperties {
  return { "--kind": color, "--kind-ink": inkOn(color) } as CSSProperties;
}

export function AddMenu({
  templates,
  tags,
  onAddTask,
  onApplyTemplate,
  onAddNote,
  disabled = false,
  openRequest = 0,
  onOpenRequestHandled,
  dateKey,
  onLogResult,
  hasResult = false,
}: AddMenuProps) {
  // Phone: a bottom sheet under the thumb (the tab bar's "+") instead of a
  // small dropdown at the top of the panel.
  const isPhone = useMediaQuery("(max-width: 700px)");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (openRequest > 0 && !disabled) setOpen(true);
    if (openRequest > 0) onOpenRequestHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRequest]);
  const [step, setStep] = useState<Step>("main");
  const [reviewingTemplate, setReviewingTemplate] = useState<Template | null>(
    null,
  );
  const [reviewTasks, setReviewTasks] = useState<TemplateTaskBlueprint[]>([]);
  const [reviewTasksLoading, setReviewTasksLoading] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  // Desktop: the template list opens beside the dropdown, over the
  // calendar - drawn on top of the whole window (a portal) and placed
  // next to the "Template" row, since the right panel crops anything that
  // sticks out of it.
  const flyoutRef = useRef<HTMLDivElement>(null);
  const templateRowRef = useRef<HTMLButtonElement>(null);
  const [flyoutPos, setFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  // Guards against a slow getTemplateTasks() call for one template landing
  // after the user has already picked a different one (or closed the menu).
  const reviewRequestRef = useRef(0);

  useEffect(() => {
    // The phone sheet is portaled outside rootRef and has its own backdrop.
    if (!open || isPhone) return;
    // Pointer, not mouse - on touch, compat mouse events fire ~300ms after
    // (or sometimes not at all for a touch that moved, e.g. into a scroll)
    // touchend, so a tap/scroll starting on a row underneath this popup
    // could land before "mousedown" ever fired here, leaving the popup open
    // and its own (opaque, higher-stacked) DOM still there to swallow that
    // same touch - looking exactly like "tapping/scrolling a row sometimes
    // does nothing" right after opening this menu.
    function onOutside(e: PointerEvent) {
      const target = e.target as Node;
      if (flyoutRef.current?.contains(target)) return;
      if (rootRef.current && !rootRef.current.contains(target)) {
        close();
      }
    }
    document.addEventListener("pointerdown", onOutside);
    return () => document.removeEventListener("pointerdown", onOutside);
  }, [open, isPhone]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const flyoutOpen = open && !isPhone && step === "templates";

  useLayoutEffect(() => {
    if (!flyoutOpen) {
      setFlyoutPos(null);
      return;
    }
    function place() {
      const row = templateRowRef.current?.getBoundingClientRect();
      const list = flyoutRef.current;
      if (!row) return;
      const width = list?.offsetWidth ?? 240;
      const height = list?.offsetHeight ?? 0;
      // To the left of the dropdown; to its right if there's no room.
      let left = row.left - 12 - width;
      if (left < 8) left = row.right + 12;
      // Level with the row, but never off the bottom of the window.
      const top = Math.max(8, Math.min(row.top - 6, window.innerHeight - height - 8));
      setFlyoutPos({ top, left });
    }
    place();
    // Once more after it has rendered (its real size is known then).
    const raf = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [flyoutOpen, templates.length]);

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
      // Everything starts unchecked - picking is the opt-in, so adding a
      // template never dumps tasks you didn't ask for onto the day.
      setSelectedIndices(new Set());
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

  function toggleSelectAll() {
    setSelectedIndices((prev) =>
      prev.size === reviewTasks.length
        ? new Set()
        : new Set(reviewTasks.map((_, i) => i)),
    );
  }

  function confirmReview() {
    if (!reviewingTemplate || selectedIndices.size === 0) return;
    onApplyTemplate(
      reviewingTemplate.id,
      [...selectedIndices].sort((a, b) => a - b),
    );
    close();
  }

  const tagColor = new Map(tags.map((t) => [t.id, t.color]));
  const colorOf = (t: Template) =>
    (t.tagId && tagColor.get(t.tagId)) || ADD_COLORS.template;
  const countLabel = (n: number) => `${n} ${n === 1 ? "task" : "tasks"}`;

  const options = [
    {
      id: "task",
      color: ADD_COLORS.task,
      icon: <CheckIcon size={16} />,
      name: "Task",
      sub: "One-off or repeating",
      kbd: "N",
      run: () => {
        onAddTask();
        close();
      },
    },
    templates.length > 0 && {
      id: "template",
      color: ADD_COLORS.template,
      icon: <BookmarkIcon size={16} />,
      name: "Template",
      sub: `${templates.length} ready to use`,
      deskSub: "Add a set of tasks",
      more: true,
      run: () => setStep((s) => (!isPhone && s === "templates" ? "main" : "templates")),
    },
    {
      id: "note",
      color: ADD_COLORS.note,
      icon: <NoteIcon size={16} />,
      name: "Note",
      sub: "Just for this day",
      run: () => {
        onAddNote();
        close();
      },
    },
    isPhone &&
      onLogResult && {
        id: "result",
        color: ADD_COLORS.result,
        icon: <TrendingUpIcon size={16} />,
        name: "Result",
        sub: hasResult ? "Edit today's result" : "Profit or loss",
        run: () => {
          close();
          onLogResult();
        },
      },
  ].filter(Boolean) as AddOption[];

  const sheetTitle =
    step === "main"
      ? `Add to ${formatDayName(dateKey)}`
      : step === "templates"
        ? "Use a template"
        : (reviewingTemplate?.name ?? "");

  // A template: its own color, its name (shortened with "..." when long -
  // never widening the menu), how many tasks it adds.
  const templateRow = (t: Template) => (
    <button
      key={t.id}
      type="button"
      className="add-menu__option add-menu__template"
      style={kind(colorOf(t))}
      onClick={() => openTemplateReview(t)}
      title={t.name}
    >
      <span className="add-menu__option-icon">
        <BookmarkIcon size={13} />
      </span>
      <span className="add-menu__option-text">
        <span className="add-menu__option-name">{t.name}</span>
        <span className="add-menu__option-sub">{countLabel(t.taskCount)}</span>
      </span>
      <span className="add-menu__option-meta">{countLabel(t.taskCount)}</span>
      <ChevronRightIcon size={13} className="add-menu__option-chevron" />
    </button>
  );

  const review = reviewingTemplate && (
    <div className="add-menu__step" key="review">
      <div className="add-menu__back-row">
        <button
          type="button"
          className="add-menu__option add-menu__option--back"
          onClick={() => setStep("templates")}
        >
          <ChevronLeftIcon size={13} />
          Back
        </button>
      </div>
      <div className="add-menu__review-header">
        <span
          className="add-menu__review-title"
          style={kind(colorOf(reviewingTemplate))}
          title={reviewingTemplate.name}
        >
          <span className="add-menu__review-dot" aria-hidden="true" />
          <span className="add-menu__review-name">{reviewingTemplate.name}</span>
        </span>
        {!reviewTasksLoading && reviewTasks.length > 0 && (
          <button
            type="button"
            className="add-menu__review-select-all"
            onClick={toggleSelectAll}
          >
            {selectedIndices.size === reviewTasks.length ? "Clear" : "Select all"}
          </button>
        )}
      </div>
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
        style={kind(ADD_COLORS.template)}
        onClick={confirmReview}
        disabled={reviewTasksLoading || selectedIndices.size === 0}
      >
        {selectedIndices.size > 0
          ? `Add ${countLabel(selectedIndices.size)}`
          : "Select tasks to add"}
      </Button>
    </div>
  );

  // Phone: a big colored tile per choice (two across); a last odd one
  // spans the full width (see AddMenu.css).
  const phoneContent =
    step === "review" ? (
      review
    ) : step === "templates" ? (
      <div className="add-menu__step" key="templates">
        <div className="add-menu__back-row">
          <button
            type="button"
            className="add-menu__option add-menu__option--back"
            onClick={() => setStep("main")}
          >
            <ChevronLeftIcon size={13} />
            Back
          </button>
        </div>
        <div className="add-menu__group">{templates.map(templateRow)}</div>
      </div>
    ) : (
      <div className="add-menu__tiles" key="main">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className="add-menu__tile"
            style={kind(o.color)}
            onClick={o.run}
          >
            <span className="add-menu__tile-icon">{o.icon}</span>
            <span className="add-menu__tile-name">{o.name}</span>
            <span className="add-menu__tile-sub">{o.sub}</span>
          </button>
        ))}
      </div>
    );

  // Desktop: the familiar dropdown, each choice with its colored square.
  // Pointing at "Template" opens your templates in a list beside it.
  const deskContent =
    step === "review" ? (
      review
    ) : (
      <div className="add-menu__step" key="main">
        {options.map((o) => (
          <button
            key={o.id}
            ref={o.more ? templateRowRef : undefined}
            type="button"
            className={`add-menu__option ${o.more && step === "templates" ? "add-menu__option--open" : ""}`}
            style={kind(o.color)}
            onClick={o.run}
            onMouseEnter={() => setStep(o.more ? "templates" : "main")}
            aria-expanded={o.more ? step === "templates" : undefined}
          >
            <span className="add-menu__option-icon">{o.icon}</span>
            <span className="add-menu__option-text">
              <span className="add-menu__option-name">{o.name}</span>
              <span className="add-menu__option-sub">{o.deskSub ?? o.sub}</span>
            </span>
            {o.kbd && <kbd className="add-menu__kbd">{o.kbd}</kbd>}
            {o.more && <ChevronRightIcon size={13} className="add-menu__option-chevron" />}
          </button>
        ))}
      </div>
    );

  return (
    <div className="add-menu" ref={rootRef}>
      <Button
        variant="primary"
        onClick={() => (open ? close() : setOpen(true))}
        disabled={disabled}
        aria-haspopup="true"
        aria-expanded={open}
      >
        + Add
      </Button>
      {open &&
        (isPhone ? (
          <Modal title={sheetTitle} onClose={close}>
            <div className="add-menu__sheet">{phoneContent}</div>
          </Modal>
        ) : (
          <>
            <div
              className={`add-menu__popup ${step === "review" ? "add-menu__popup--wide" : ""}`}
            >
              {deskContent}
            </div>
            {flyoutOpen &&
              createPortal(
                <div
                  className="add-menu__flyout"
                  ref={flyoutRef}
                  role="menu"
                  aria-label="Your templates"
                  style={
                    flyoutPos
                      ? { top: flyoutPos.top, left: flyoutPos.left }
                      : { visibility: "hidden" }
                  }
                >
                  <span className="add-menu__flyout-title">Your templates</span>
                  {templates.map(templateRow)}
                </div>,
                document.body,
              )}
          </>
        ))}
    </div>
  );
}
