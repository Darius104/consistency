import type { CSSProperties } from "react";
import type { Tag } from "../../types";
import type { TemplateBreakdownItem } from "../../utils/stats";
import { CheckIcon } from "../ui/icons";
import "./stats.css";

interface TemplateBreakdownProps {
  data: TemplateBreakdownItem[];
  tags: Tag[];
  /** Phone tile: at most this many rows, smaller type. */
  compact?: boolean;
}

/** Per-template progress for the week, scored "so far" (up to today - see
 *  computeTemplateBreakdown). Each row is name + done/total + percent on
 *  one line and a full-width bar under it, so every bar starts at the same
 *  edge however long the template's name is. The bar covers the whole
 *  week: done, then still-open so far, then a faint "still to come"
 *  stretch for the days after today. */
export function TemplateBreakdown({ data, tags, compact = false }: TemplateBreakdownProps) {
  const rows = compact ? data.slice(0, 3) : data;

  return (
    <div className={`stat-card template-breakdown ${compact ? "template-breakdown--compact" : ""}`}>
      <div className="template-breakdown__head">
        <span className="stat-card__label">Templates · this week</span>
        {!compact && data.length > 0 && <span className="template-breakdown__hint">so far</span>}
      </div>
      {data.length === 0 ? (
        <div className="template-breakdown__empty">Nothing scheduled this week</div>
      ) : (
        <div className="template-breakdown__rows">
          {rows.map((item) => {
            const tag = item.tagId ? tags.find((t) => t.id === item.tagId) : undefined;
            const color = tag?.color ?? "var(--text-muted)";
            const total = item.scheduled + item.upcoming;
            const pct = (n: number) => (total === 0 ? 0 : (n / total) * 100);
            const allDone = item.scheduled > 0 && item.completed === item.scheduled;
            return (
              <div
                className="template-breakdown__row"
                key={item.tagId ?? "none"}
                style={{ "--tpl": color } as CSSProperties}
              >
                <div className="template-breakdown__line">
                  <span className="template-breakdown__dot" aria-hidden="true" />
                  <span className="template-breakdown__name">{tag?.name ?? "No template"}</span>
                  {item.scheduled === 0 ? (
                    <span className="template-breakdown__later">{item.upcoming} later</span>
                  ) : (
                    <>
                      <span className="template-breakdown__count">
                        {item.completed}/{item.scheduled}
                      </span>
                      <span
                        className={`template-breakdown__percent ${
                          allDone ? "template-breakdown__percent--done" : ""
                        }`}
                      >
                        {allDone ? <CheckIcon size={13} /> : `${item.percent}%`}
                      </span>
                    </>
                  )}
                </div>
                <div
                  className="template-breakdown__bar"
                  role="img"
                  aria-label={`${item.completed} of ${item.scheduled} done so far, ${item.upcoming} still to come`}
                >
                  <span className="template-breakdown__bar-done" style={{ width: `${pct(item.completed)}%` }} />
                  <span
                    className="template-breakdown__bar-open"
                    style={{ width: `${pct(item.scheduled - item.completed)}%` }}
                  />
                  <span className="template-breakdown__bar-later" style={{ width: `${pct(item.upcoming)}%` }} />
                </div>
              </div>
            );
          })}
          {compact && data.length > rows.length && (
            <span className="template-breakdown__more">+{data.length - rows.length} more</span>
          )}
        </div>
      )}
    </div>
  );
}
