import type { Tag } from "../../types";
import type { CategoryBreakdownItem } from "../../utils/stats";
import "./stats.css";

interface CategoryBreakdownProps {
  data: CategoryBreakdownItem[];
  tags: Tag[];
}

export function CategoryBreakdown({ data, tags }: CategoryBreakdownProps) {
  if (data.length === 0) {
    return (
      <div className="stat-card">
        <div className="stat-card__label">Nothing scheduled this week</div>
      </div>
    );
  }

  return (
    <div className="stat-card category-breakdown">
      <div className="stat-card__label">by category this week</div>
      <div className="category-breakdown__rows">
        {data.map((item) => {
          const tag = tags.find((t) => t.id === item.tagId);
          return (
            <div className="category-breakdown__row" key={item.tagId ?? "none"}>
              <span
                className="category-breakdown__dot"
                style={{ background: tag?.color ?? "var(--text-muted)" }}
                aria-hidden="true"
              />
              <span className="category-breakdown__name">{tag?.name ?? "No category"}</span>
              <div className="category-breakdown__bar">
                <div
                  className="category-breakdown__bar-fill"
                  style={{ width: `${item.percent}%`, background: tag?.color ?? "var(--accent)" }}
                />
              </div>
              <span className="category-breakdown__percent">{item.percent}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
