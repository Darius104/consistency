import { useState } from "react";
import type { CSSProperties } from "react";
import type { Tag } from "../../types";
import { PRESET_COLORS } from "../../utils/tagColors";
import { CheckIcon } from "../ui/icons";
import "./TagPicker.css";

interface TagPickerProps {
  tags: Tag[];
  selectedTagId: string | null;
  onChange: (tagId: string | null) => void;
  onCreateTag: (name: string, color: string) => Promise<Tag>;
}

export function TagPicker({
  tags,
  selectedTagId,
  onChange,
  onCreateTag,
}: TagPickerProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const tag = await onCreateTag(trimmed, color);
    onChange(tag.id);
    setCreating(false);
    setName("");
    setColor(PRESET_COLORS[0]);
  }

  return (
    <div className="tag-picker">
      <div className="tag-picker__options">
        <button
          type="button"
          className={`tag-picker__pill ${selectedTagId === null ? "tag-picker__pill--active-none" : ""}`}
          onClick={() => onChange(null)}
        >
          None
          {selectedTagId === null && <CheckIcon size={12} />}
        </button>
        {tags.map((tag) => {
          const isActive = selectedTagId === tag.id;
          const activeStyle: CSSProperties | undefined = isActive
            ? {
                borderColor: tag.color,
                background: `${tag.color}2a`,
                color: tag.color,
              }
            : undefined;
          return (
            <button
              type="button"
              key={tag.id}
              className={`tag-picker__pill ${isActive ? "tag-picker__pill--active" : ""}`}
              style={activeStyle}
              onClick={() => onChange(tag.id)}
            >
              <span className="tag-picker__dot" style={{ background: tag.color }} />
              {tag.name}
              {isActive && <CheckIcon size={12} />}
            </button>
          );
        })}
        <button
          type="button"
          className="tag-picker__pill tag-picker__pill--add"
          onClick={() => setCreating((v) => !v)}
        >
          + New
        </button>
      </div>

      {creating && (
        <div className="tag-picker__new">
          <input
            className="tag-picker__input"
            placeholder="Category name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <div className="tag-picker__colors">
            {PRESET_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                className={`tag-picker__swatch ${color === c ? "tag-picker__swatch--active" : ""}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={`Choose color ${c}`}
              />
            ))}
          </div>
          <button type="button" className="tag-picker__confirm" onClick={handleCreate}>
            Add
          </button>
        </div>
      )}
    </div>
  );
}
