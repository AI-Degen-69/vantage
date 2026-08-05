import { Link, useLocation } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { useIndexQuotes } from "@/hooks/useStockData";
import type { IndexQuote } from "@shared/api";
import { EarningsAlertStrip } from "@/components/EarningsAlertStrip";
import { EarningsAlertHistoryButton } from "@/components/EarningsAlertHistoryPanel";
import TickerLogo from "@/components/TickerLogo";

/**
 * Provides the styling classes for an index quote pill container.
 *
 * @returns The Tailwind CSS classes used to style the pill container.
 */
function pillClassName() {
  return "flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/80 border border-border";
}

/**
 * Renders a market index pill with its label, percentage change, and data status.
 *
 * @param label - The index name displayed in the pill.
 * @param quote - The current index quote, when available.
 * @param loading - Whether the quote data is still loading.
 * @param language - The interface language used for accessibility labeling.
 */
function Pill({
  label,
  quote,
  loading,
  language,
}: {
  label: string;
  quote: IndexQuote | null | undefined;
  loading: boolean;
  language: string;
}) {
  const live = !!quote;
  const sign = (quote?.changesPercentage ?? 0) >= 0 ? "+" : "";
  const cls = live
    ? quote!.changesPercentage >= 0
      ? "text-chart-positive"
      : "text-chart-negative"
    : "text-muted-foreground";
  const ariaSuffix = language === "he" ? ` (${label})` : "";
  return (
    <div className={pillClassName()} aria-label={`${label} ${ariaSuffix}`}>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <span
        className={`text-xs font-semibold font-mono tabular-nums ${cls}`}
        dir="ltr"
      >
        {loading
          ? "…"
          : quote
            ? `${sign}${quote.changesPercentage.toFixed(2)}%`
            : "—"}
      </span>
      <span
        className={`text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded ${
          live
            ? "text-chart-positive bg-chart-positive/10"
            : "text-muted-foreground bg-muted/40"
        }`}
        title={live ? "Live quote" : "No live data"}
      >
        {live ? "●" : "○"}
      </span>
    </div>
  );
}

/**
 * Displays how recently market data was fetched.
 *
 * @param updatedAt - The timestamp of the most recent data update, or `null` when unavailable
 */
function Freshness({ updatedAt }: { updatedAt: number | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!updatedAt) {
    return <span className="text-[10px] text-muted-foreground">·</span>;
  }
  const agoSec = Math.max(0, Math.round((now - updatedAt) / 1000));
  const label = agoSec < 2 ? "now" : `${agoSec}s`;
  return (
    <span
      className="text-[10px] text-muted-foreground font-mono tabular-nums"
      title={`Last fetched at ${new Date(updatedAt).toLocaleTimeString()}`}
    >
      · {label}
    </span>
  );
}

/**
 * Renders the application header with navigation context, market index summaries, and data freshness.
 */
export default function TopBar() {
  const { t, lang } = useI18n();
  const location = useLocation();
  const { data, isLoading, dataUpdatedAt } = useIndexQuotes();

  // Helper to generate the breadcrumb label for the current path. The
  // /stock/:ticker case renders the nav label + logo + ticker as separate
  // elements below, so this exposes just the label.
  const getBreadcrumbLabel = () => {
    const path = location.pathname;
    if (path === "/insights" || path.startsWith("/stock/"))
      return t("nav.insights");
    if (path === "/watchlists") return t("nav.watchlists");
    if (path === "/charts") return t("nav.charts");
    if (path === "/earnings") return t("nav.earnings");
    if (path === "/portfolios") return t("nav.portfolios");
    return "";
  };

  // On /stock/<ticker> pages, surface the company logo in the breadcrumb
  // next to the ticker so the stock context is identifiable at a glance
  // (the page header already shows a larger logo). An empty ticker
  // (`/stock/` with nothing after) stays falsy and falls back to the
  // plain label breadcrumb.
  const stockTicker = location.pathname.startsWith("/stock/")
    ? location.pathname.replace("/stock/", "").toUpperCase()
    : null;

  // Use lang directly from the I18nProvider context — flips on toggle.
  const language = lang;

  return (
    <header className="h-16 border-b border-border bg-background/80 backdrop-blur flex items-center justify-between px-6 sticky top-0 z-40 w-full shrink-0">
      {/* Left section: Wordmark + Breadcrumb */}
      <div className="flex items-center gap-4">
        <Link
          to="/"
          className="text-xl font-bold tracking-widest text-foreground"
        >
          VANTAGE
        </Link>
        <div className="h-4 w-[1px] bg-border mx-2" />
        {stockTicker ? (
          <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <span>{getBreadcrumbLabel()}</span>
            <span className="text-border">·</span>
            <TickerLogo
              ticker={stockTicker}
              size="xs"
              ariaLabel={`${stockTicker} logo`}
            />
            <span className="font-mono" dir="ltr">
              {stockTicker}
            </span>
          </span>
        ) : (
          <span className="text-sm font-medium text-muted-foreground">
            {getBreadcrumbLabel()}
          </span>
        )}
      </div>

      {/* Center section */}
      <div className="flex-1 flex justify-center" />

      {/* The strip itself renders nothing — it dispatches sonner toasts via
          the engine mounted above. Mounting it inside TopBar ensures it's
          reactive to watchlist symbols + financial-calendar polling while
          the rest of the page is alive. The history button is the user-
          visible Bell badge that opens the per-day acknowledged-alerts
          popover. */}
      <EarningsAlertStrip />
      <EarningsAlertHistoryButton />

      {/* Right section: Market index pills */}
      <div className="flex items-center gap-2">
        <Pill
          label={t("topBar.indicesDow")}
          quote={data?.dow}
          loading={isLoading}
          language={language}
        />
        <Pill
          label={t("topBar.indicesSp500")}
          quote={data?.sp500}
          loading={isLoading}
          language={language}
        />
        <Pill
          label={t("topBar.indicesNasdaq")}
          quote={data?.nasdaq}
          loading={isLoading}
          language={language}
        />
        <Freshness updatedAt={dataUpdatedAt} />
      </div>
    </header>
  );
}
