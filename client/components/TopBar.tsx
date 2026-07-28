import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { useIndexQuotes } from "@/hooks/useStockData";
import type { IndexQuote } from "@shared/api";

function pillClassName() {
  return "flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/50";
}

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
    ? (quote!.changesPercentage >= 0 ? "text-green-400" : "text-red-400")
    : "text-slate-500";
  const ariaSuffix = language === "he" ? ` (${label})` : "";
  return (
    <div className={pillClassName()} aria-label={`${label} ${ariaSuffix}`}>
      <span className="text-xs text-slate-300 font-medium">{label}</span>
      <span className={`text-xs font-semibold ${cls}`} dir="ltr">
        {loading
          ? "…"
          : quote
          ? `${sign}${quote.changesPercentage.toFixed(2)}%`
          : "—"}
      </span>
      <span
        className={`text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded ${
          live
            ? "text-emerald-300 bg-emerald-500/10"
            : "text-yellow-400 bg-yellow-500/10"
        }`}
        title={live ? "Live quote" : "No live data"}
      >
        {live ? "●" : "○"}
      </span>
    </div>
  );
}

function Freshness({ updatedAt }: { updatedAt: number | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!updatedAt) {
    return <span className="text-[10px] text-slate-500">·</span>;
  }
  const agoSec = Math.max(0, Math.round((now - updatedAt) / 1000));
  const label =
    agoSec < 2
      ? "now"
      : `${agoSec}s`;
  return (
    <span
      className="text-[10px] text-slate-500"
      title={`Last fetched at ${new Date(updatedAt).toLocaleTimeString()}`}
    >
      · {label}
    </span>
  );
}

export default function TopBar() {
  const { t } = useTranslation();
  const location = useLocation();
  const { data, isLoading, dataUpdatedAt } = useIndexQuotes();

  // Helper to generate breadcrumb from current path
  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path === "/insights" || path.startsWith("/stock/")) {
      const ticker = path.startsWith("/stock/") ? path.replace("/stock/", "").toUpperCase() : "";
      return ticker ? `${t("sidebar.insights")} · ${ticker}` : t("sidebar.insights");
    }
    if (path === "/watchlists") return t("sidebar.watchlists");
    if (path === "/charts") return t("sidebar.charts");
    if (path === "/earnings") return t("sidebar.earnings");
    if (path === "/portfolios") return t("sidebar.portfolios");
    return "";
  };

  // Detect UI language from html dir attribute as a cheap + reliable signal
  // (i18n.language flips on toggle; we just need it for an aria-suffix).
  const language = typeof document !== "undefined" && document.documentElement.dir === "rtl" ? "he" : "en";

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur flex items-center justify-between px-6 sticky top-0 z-40 w-full shrink-0">
      {/* Left section: Wordmark + Breadcrumb */}
      <div className="flex items-center gap-4">
        <Link to="/" className="text-xl font-bold tracking-widest text-white">
          QUALTRIM
        </Link>
        <div className="h-4 w-[1px] bg-slate-700 mx-2" />
        <span className="text-sm font-medium text-slate-300">
          {getBreadcrumb()}
        </span>
      </div>

      {/* Center section */}
      <div className="flex-1 flex justify-center" />

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
