import { useEffect, useRef, useState } from "react";
import type { Template } from "../../types";
import { Button } from "../ui/Button";
import "./TemplatePicker.css";

interface TemplatePickerProps {
  templates: Template[];
  onApply: (templateId: number) => void;
}

export function TemplatePicker({ templates, onApply }: TemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  if (templates.length === 0) return null;

  return (
    <div className="template-picker" ref={rootRef}>
      <Button onClick={() => setOpen((v) => !v)}>+ Template</Button>
      {open && (
        <div className="template-picker__popup">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              className="template-picker__option"
              onClick={() => {
                onApply(t.id);
                setOpen(false);
              }}
            >
              <span className="template-picker__name">{t.name}</span>
              <span className="template-picker__count">
                {t.taskCount} {t.taskCount === 1 ? "task" : "tasks"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
