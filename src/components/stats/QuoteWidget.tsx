import type { CSSProperties } from "react";
import { QUOTE_CATEGORY_COLOR_VAR, QUOTE_CATEGORY_LABEL, type Quote } from "../../utils/quotes";
import "./stats.css";

interface QuoteWidgetProps {
  quote: Quote;
}

export function QuoteWidget({ quote }: QuoteWidgetProps) {
  const colorVar = QUOTE_CATEGORY_COLOR_VAR[quote.category];

  return (
    <div className="quote-widget" style={{ "--phrase-color": `var(${colorVar})` } as CSSProperties}>
      <span className="quote-widget__category">{QUOTE_CATEGORY_LABEL[quote.category]}</span>
      <p className="quote-widget__text">{quote.text}</p>
    </div>
  );
}
