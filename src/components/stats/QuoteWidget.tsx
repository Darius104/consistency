import type { CSSProperties } from "react";
import { WIDGET_COLORS } from "../../utils/panelOrder";
import { QUOTE_CATEGORY_COLOR, QUOTE_CATEGORY_LABEL, type Quote } from "../../utils/quotes";
import { SparklesIcon } from "../ui/icons";
import { WidgetCard } from "./WidgetCard";
import "./stats.css";

interface QuoteWidgetProps {
  quote: Quote;
}

export function QuoteWidget({ quote }: QuoteWidgetProps) {

  return (
    <WidgetCard
      color={WIDGET_COLORS.quote}
      icon={<SparklesIcon size={13} />}
      title="Phrase of the day"
    >
      <blockquote className="quote-widget">
        <span className="quote-widget__mark" aria-hidden="true">
          “
        </span>
        <p className="quote-widget__text">{quote.text}</p>
        {/* Under the line rather than in the header - some categories are
            long ("Mindset & Execution") and squeezed the title there. */}
        <span
          className="quote-widget__category"
          style={{ "--phrase-color": QUOTE_CATEGORY_COLOR[quote.category] } as CSSProperties}
        >
          {QUOTE_CATEGORY_LABEL[quote.category]}
        </span>
      </blockquote>
    </WidgetCard>
  );
}
