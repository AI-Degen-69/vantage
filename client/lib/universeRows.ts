/**
 * Shared presentation view for a live quote row in the Insights
 * universe lists. Single source for the price/percent/color derivation
 * that used to be copy-pasted across the three layout variants in
 * `client/pages/Insights.tsx` — a formatting fix now lands once.
 */
export interface QuoteRowView {
  /** `$227.50` when the quote is live, otherwise an em-dash. */
  liveText: string;
  /** `+1.26%` / `-2.40%` with explicit sign, or an em-dash. */
  pctText: string;
  /** Tailwind text-color class reflecting change direction. */
  cls: string;
}

export function presentQuoteRow(row: {
  price?: number;
  changePercent?: number;
}): QuoteRowView {
  const live = row.price !== undefined && Number.isFinite(row.price);
  // Normalize non-finite changePercent (NaN / ±Infinity) to the same
  // unavailable state as a missing value — otherwise it leaks into the
  // output as "+NaN%" or "+Infinity%".
  const pct =
    row.changePercent !== undefined && Number.isFinite(row.changePercent)
      ? row.changePercent
      : undefined;
  const sign = pct === undefined || pct < 0 ? "" : "+";
  return {
    liveText: live ? `$${row.price!.toFixed(2)}` : "—",
    pctText: pct === undefined ? "—" : `${sign}${pct.toFixed(2)}%`,
    cls:
      pct === undefined
        ? "text-muted-foreground"
        : pct >= 0
          ? "text-chart-positive"
          : "text-chart-negative",
  };
}
