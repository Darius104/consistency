/**
 * Formatted day notes. A note is still one text field in the database: a
 * plain note is stored as-is (so older app versions keep showing it), a
 * formatted one as RICH_PREFIX + a small, cleaned-up subset of HTML.
 *
 * Everything that comes out of the editor or the database goes through
 * sanitizeNoteHtml before it's shown, which keeps only the handful of tags
 * and attributes the toolbar can produce - so a note can never carry
 * scripts, links, images or styles into the page.
 */

export const RICH_PREFIX = "<!--rich-->";

/** The toolbar's text colors - stored as class names, not raw styles. */
export const NOTE_COLORS = [
  { id: "red", label: "Red", hex: "#ef4444" },
  { id: "orange", label: "Orange", hex: "#f59e0b" },
  { id: "green", label: "Green", hex: "#22c55e" },
  { id: "blue", label: "Blue", hex: "#3b82f6" },
] as const;

export type NoteColorId = (typeof NOTE_COLORS)[number]["id"];

const COLOR_CLASS_PREFIX = "note-c-";

const ALLOWED_TAGS = new Set([
  "B",
  "STRONG",
  "I",
  "EM",
  "S",
  "STRIKE",
  "DEL",
  "U",
  "SPAN",
  "FONT",
  "UL",
  "OL",
  "LI",
  "BR",
  "DIV",
  "P",
]);

/** "#ef4444" / "rgb(239, 68, 68)" -> the palette color it came from. */
function colorIdFor(value: string): NoteColorId | null {
  const v = value.trim().toLowerCase();
  let rgb: [number, number, number] | null = null;
  const hex = v.match(/^#([0-9a-f]{6})$/);
  if (hex) {
    const n = parseInt(hex[1], 16);
    rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const fn = v.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (fn) rgb = [Number(fn[1]), Number(fn[2]), Number(fn[3])];
  if (!rgb) return null;
  for (const c of NOTE_COLORS) {
    const n = parseInt(c.hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    if (Math.abs(r - rgb[0]) + Math.abs(g - rgb[1]) + Math.abs(b - rgb[2]) < 12)
      return c.id;
  }
  return null;
}

function cleanNode(node: Node, doc: Document): Node | null {
  if (node.nodeType === Node.TEXT_NODE)
    return doc.createTextNode(node.textContent ?? "");
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as HTMLElement;
  const tag = el.tagName;

  const children = () => {
    const frag = doc.createDocumentFragment();
    for (const child of Array.from(el.childNodes)) {
      const c = cleanNode(child, doc);
      if (c) frag.appendChild(c);
    }
    return frag;
  };

  // Unknown tags (or anything risky) keep their text, lose the tag.
  if (!ALLOWED_TAGS.has(tag)) return children();

  // Color: from the toolbar's own class, or the <font color> / inline
  // style the browser's own color command produces - normalized to a class.
  if (tag === "SPAN" || tag === "FONT") {
    const fromClass = Array.from(el.classList)
      .find((c) => c.startsWith(COLOR_CLASS_PREFIX))
      ?.slice(COLOR_CLASS_PREFIX.length);
    const raw = el.getAttribute("color") || el.style?.color || "";
    const id =
      (NOTE_COLORS.some((c) => c.id === fromClass)
        ? (fromClass as NoteColorId)
        : null) ?? (raw ? colorIdFor(raw) : null);
    if (!id) return children();
    const span = doc.createElement("span");
    span.className = COLOR_CLASS_PREFIX + id;
    span.appendChild(children());
    return span;
  }

  const normalized =
    { STRONG: "B", EM: "I", STRIKE: "S", DEL: "S" }[tag] ?? tag;
  const out = doc.createElement(normalized.toLowerCase());
  if (tag === "UL" && el.hasAttribute("data-checklist"))
    out.setAttribute("data-checklist", "");
  if (tag === "LI" && el.getAttribute("data-checked") === "true")
    out.setAttribute("data-checked", "true");
  out.appendChild(children());
  return out;
}

/** Keeps only what the toolbar can make - see this file's header. */
export function sanitizeNoteHtml(html: string): string {
  const doc = document.implementation.createHTMLDocument("");
  const src = doc.createElement("div");
  src.innerHTML = html;
  const out = doc.createElement("div");
  for (const child of Array.from(src.childNodes)) {
    const c = cleanNode(child, doc);
    if (c) out.appendChild(c);
  }
  return out.innerHTML;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function isRichNote(content: string): boolean {
  return content.startsWith(RICH_PREFIX);
}

/** Safe HTML for showing (and editing) a note - formatted or plain. */
export function noteToHtml(content: string): string {
  if (isRichNote(content))
    return sanitizeNoteHtml(content.slice(RICH_PREFIX.length));
  return escapeHtml(content).replace(/\n/g, "<br>");
}

/** Text with line breaks kept - <br> and block elements (the editor puts
 *  each line in its own <div>) become newlines. innerText can't be used:
 *  it needs a laid-out element and would glue lines together. */
function htmlToText(html: string): string {
  const box = document.createElement("div");
  box.innerHTML = html;
  let text = "";
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? "";
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = (node as Element).tagName;
    if (tag === "BR") {
      text += "\n";
      return;
    }
    const block = tag === "DIV" || tag === "P" || tag === "LI";
    if (block && text && !text.endsWith("\n")) text += "\n";
    node.childNodes.forEach(walk);
    if (block && !text.endsWith("\n")) text += "\n";
  };
  box.childNodes.forEach(walk);
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

/** What to store for the editor's HTML: plain text when nothing is
 *  formatted (so it stays readable everywhere), otherwise the rich form.
 *  Empty when there's no actual text. */
export function htmlToNoteContent(html: string): string {
  const clean = sanitizeNoteHtml(html);
  const text = htmlToText(clean);
  if (!text) return "";
  const formatted = /<(b|i|s|u|ul|ol|span)\b/.test(clean);
  return formatted ? RICH_PREFIX + clean : text;
}

/** Plain text, e.g. for the delete confirmation. */
export function noteToPlainText(content: string): string {
  if (!isRichNote(content)) return content;
  return htmlToText(noteToHtml(content));
}

/** Ticks / unticks the index-th checklist item (in document order) and
 *  returns the updated note content - for ticking right on the note card. */
export function toggleChecklistItem(content: string, index: number): string {
  const box = document.createElement("div");
  box.innerHTML = noteToHtml(content);
  const items = box.querySelectorAll("ul[data-checklist] > li");
  const li = items[index];
  if (!li) return content;
  if (li.getAttribute("data-checked") === "true")
    li.removeAttribute("data-checked");
  else li.setAttribute("data-checked", "true");
  return RICH_PREFIX + sanitizeNoteHtml(box.innerHTML);
}
