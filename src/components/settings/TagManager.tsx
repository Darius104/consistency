import { useState } from "react";
import type { Tag } from "../../types";
import { PRESET_COLORS } from "../../utils/tagColors";
import { XIcon } from "../ui/icons";
import "./TagManager.css";

interface TagManagerProps {
  tags: Tag[];
  onUpdateTag: (id: number, name: string, color: string) => void;
  onDeleteTag: (id: number) => void;
}

export function TagManager({ tags, onUpdateTag, onDeleteTag }: TagManagerProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftColor, setDraftColor] = useState("");

  function startEditing(tag: Tag) {
    setEditingId(tag.id);
    setDraftName(tag.name);
    setDraftColor(tag.color);
  }

  function commit() {
    const trimmed = draftName.trim();
    if (editingId !== null && trimmed) {
      onUpdateTag(editingId, trimmed, draftColor);
    }
    setEditingId(null);
  }

  if (tags.length === 0) {
    return (
      <span className="tag-manager__empty">
        No categories yet - create one from a task's category picker.
      </span>
    );
  }

  return (
    <div className="tag-manager">
      {tags.map((tag) => {
        const isEditing = editingId === tag.id;

        if (isEditing) {
          return (
            <div className="tag-manager__row tag-manager__row--editing" key={tag.id}>
              <input
                className="tag-manager__input"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") setEditingId(null);
                }}
                autoFocus
              />
              <div className="tag-manager__colors">
                {PRESET_COLORS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    className={`tag-manager__swatch ${draftColor === c ? "tag-manager__swatch--active" : ""}`}
                    style={{ background: c }}
                    onClick={() => setDraftColor(c)}
                    aria-label={`Choose color ${c}`}
                  />
                ))}
              </div>
              <button type="button" className="tag-manager__done" onClick={commit}>
                Done
              </button>
            </div>
          );
        }

        return (
          <div className="tag-manager__row" key={tag.id}>
            <button
              type="button"
              className="tag-manager__tag"
              onClick={() => startEditing(tag)}
            >
              <span className="tag-manager__dot" style={{ background: tag.color }} />
              <span className="tag-manager__tag-name">{tag.name}</span>
            </button>
            <button
              type="button"
              className="tag-manager__delete"
              aria-label={`Delete category ${tag.name}`}
              onClick={() => onDeleteTag(tag.id)}
            >
              <XIcon size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
