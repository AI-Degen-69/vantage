import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function TopBar() {
  const { t } = useTranslation();
  const location = useLocation();

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

      {/* Center section: Page-specific toolbar placeholder */}
      <div className="flex-1 flex justify-center">
        {/* Placeholder for future page-specific controls */}
      </div>

      {/* Right section: Market index pills */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/50">
          <span className="text-xs text-slate-300 font-medium">Dow Jones</span>
          <span className="text-xs font-semibold text-green-400" dir="ltr">+1.17%</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/50">
          <span className="text-xs text-slate-300 font-medium">S&P 500</span>
          <span className="text-xs font-semibold text-green-400" dir="ltr">+0.76%</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/50">
          <span className="text-xs text-slate-300 font-medium">Nasdaq</span>
          <span className="text-xs font-semibold text-green-400" dir="ltr">+0.42%</span>
        </div>
      </div>
    </header>
  );
}
