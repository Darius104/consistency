import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { DayNote } from "../../types";
import {
  NOTE_COLORS,
  htmlToNoteContent,
  noteToHtml,
} from "../../utils/richNote";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import "./NoteForm.css";
import "./NoteRich.css";

interface NoteFormProps {
  note?: DayNote;
  onSave: (content: string) => void;
  onClose: () => void;
  /** Editing an existing note - shows "Delete note" (the phone has no
   *  other way to delete one). */
  onDelete?: () => void;
}

type Format =
  | "bold"
  | "italic"
  | "strikeThrough"
  | "insertUnorderedList"
  | "insertOrderedList";

// A formatting editor (what you see is what you get - no symbols to type):
// the toolbar uses the browser's own editing commands on the selection, and
// what comes out is cleaned up by richNote.ts before it's saved or shown.
export function NoteForm({ note, onSave, onClose, onDelete }: NoteFormProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(!note?.content);
  const [active, setActive] = useState<Set<string>>(new Set());
  const [colorsOpen, setColorsOpen] = useState(false);

  useLayoutEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = note ? noteToHtml(note.content) : "";
    // Colors as <font color>, which richNote turns into its own classes.
    document.execCommand("styleWithCSS", false, "false");
    el.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Which toolbar buttons light up, following the cursor.
  function refreshState() {
    const el = editorRef.current;
    if (!el) return;
    setEmpty(!(el.innerText ?? "").trim() && !el.querySelector("li"));
    const next = new Set<string>();
    for (const cmd of [
      "bold",
      "italic",
      "strikeThrough",
      "insertOrderedList",
    ] as const) {
      try {
        if (document.queryCommandState(cmd)) next.add(cmd);
      } catch {
        // Not supported - just don't highlight it.
      }
    }
    const list = closestList();
    if (list?.tagName === "UL")
      next.add(
        list.hasAttribute("data-checklist")
          ? "checklist"
          : "insertUnorderedList",
      );
    setActive(next);
  }

  useEffect(() => {
    document.addEventListener("selectionchange", refreshState);
    return () => document.removeEventListener("selectionchange", refreshState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function closestList(): HTMLElement | null {
    const sel = window.getSelection();
    const node = sel?.anchorNode;
    if (!node || !editorRef.current?.contains(node)) return null;
    const el =
      node.nodeType === Node.ELEMENT_NODE
        ? (node as HTMLElement)
        : node.parentElement;
    return el?.closest("ul, ol") ?? null;
  }

  // Toolbar buttons act on pointer down, with the default prevented, so
  // the editor keeps its selection - and the phone keeps its keyboard up.
  function press(e: ReactPointerEvent, action: () => void) {
    e.preventDefault();
    editorRef.current?.focus();
    action();
    refreshState();
  }

  function format(cmd: Format) {
    document.execCommand(cmd, false);
  }

  function toggleChecklist() {
    const list = closestList();
    if (list?.tagName === "UL" && list.hasAttribute("data-checklist")) {
      // Already a checklist - turn it back into plain text.
      document.execCommand("insertUnorderedList", false);
      return;
    }
    if (!list || list.tagName !== "UL")
      document.execCommand("insertUnorderedList", false);
    closestList()?.setAttribute("data-checklist", "");
  }

  function applyColor(hex: string | null) {
    // "Default" = the normal text color, which the cleanup drops as "no color".
    const fallback = getComputedStyle(editorRef.current!).color;
    document.execCommand("foreColor", false, hex ?? fallback);
    setColorsOpen(false);
  }

  function handleSave() {
    const content = htmlToNoteContent(editorRef.current?.innerHTML ?? "");
    if (!content) return;
    onSave(content);
  }

  const tools: { id: string; label: string; icon: string; run: () => void }[] =
    [
      { id: "bold", label: "Bold", icon: "B", run: () => format("bold") },
      { id: "italic", label: "Italic", icon: "I", run: () => format("italic") },
      {
        id: "strikeThrough",
        label: "Strikethrough",
        icon: "S",
        run: () => format("strikeThrough"),
      },
      {
        id: "insertUnorderedList",
        label: "Bullet list",
        icon: "•",
        run: () => format("insertUnorderedList"),
      },
      {
        id: "insertOrderedList",
        label: "Numbered list",
        icon: "1.",
        run: () => format("insertOrderedList"),
      },
      { id: "checklist", label: "Checklist", icon: "☐", run: toggleChecklist },
    ];

  return (
    <Modal title={note ? "Edit note" : "New note"} onClose={onClose}>
      <div className="note-form">
        <div
          className="note-form__toolbar"
          role="toolbar"
          aria-label="Formatting"
        >
          {tools.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`note-form__tool note-form__tool--${t.id} ${active.has(t.id) ? "note-form__tool--active" : ""}`}
              aria-label={t.label}
              aria-pressed={active.has(t.id)}
              onPointerDown={(e) => press(e, t.run)}
            >
              {t.icon}
            </button>
          ))}
          <div className="note-form__color-wrap">
            <button
              type="button"
              className={`note-form__tool ${colorsOpen ? "note-form__tool--active" : ""}`}
              aria-label="Text color"
              aria-expanded={colorsOpen}
              onPointerDown={(e) => {
                e.preventDefault();
                setColorsOpen((v) => !v);
              }}
            >
              <span className="note-form__color-icon">A</span>
            </button>
            {colorsOpen && (
              <div className="note-form__colors">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="note-form__swatch"
                    style={{ background: c.hex }}
                    aria-label={c.label}
                    onPointerDown={(e) => press(e, () => applyColor(c.hex))}
                  />
                ))}
                <button
                  type="button"
                  className="note-form__swatch note-form__swatch--default"
                  aria-label="Default color"
                  onPointerDown={(e) => press(e, () => applyColor(null))}
                >
                  ⌀
                </button>
              </div>
            )}
          </div>
        </div>

        <div
          ref={editorRef}
          className={`note-form__editor note-rich ${empty ? "note-form__editor--empty" : ""}`}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Note text"
          data-placeholder="Write a quick note for today…"
          onInput={refreshState}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSave();
            }
            if (e.key === "Escape") onClose();
            // A new checklist line starts unticked (the browser would copy
            // the tick from the line above).
            if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
              window.setTimeout(() => {
                const sel = window.getSelection();
                const node = sel?.anchorNode;
                const el =
                  node &&
                  (node.nodeType === Node.ELEMENT_NODE
                    ? (node as HTMLElement)
                    : node.parentElement);
                el?.closest("li")?.removeAttribute("data-checked");
              }, 0);
            }
          }}
          onClick={(e) => {
            // Tapping a checklist line's box ticks it.
            const li = (e.target as HTMLElement).closest(
              "ul[data-checklist] > li",
            );
            if (!li) return;
            const box = li.getBoundingClientRect();
            if (e.clientX - box.left > 26) return;
            if (li.getAttribute("data-checked") === "true")
              li.removeAttribute("data-checked");
            else li.setAttribute("data-checked", "true");
          }}
        />

        <div className="note-form__actions">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={empty}>
            {note ? "Save" : "Add"}
          </Button>
        </div>
        {note && onDelete && (
          <button
            type="button"
            className="note-form__delete"
            onClick={onDelete}
          >
            Delete note
          </button>
        )}
      </div>
    </Modal>
  );
}
