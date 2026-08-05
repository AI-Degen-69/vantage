import { Link, useLocation } from "react-router-dom";
import { BarChart3, List, TrendingUp, Calendar } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import LanguageSwitcher from "./LanguageSwitcher";
import { getLogoDevAttributionUrl } from "@/lib/logoDev";

const navItems = [
  {
    i18nKey: "nav.insights",
    href: "/insights",
    icon: BarChart3,
  },
  {
    i18nKey: "nav.watchlists",
    href: "/watchlists",
    icon: List,
  },
  {
    i18nKey: "nav.charts",
    href: "/charts",
    icon: TrendingUp,
  },
  {
    i18nKey: "nav.earnings",
    href: "/earnings",
    icon: Calendar,
  },
  {
    i18nKey: "nav.portfolios",
    href: "/portfolios",
    icon: List, // Temporary icon for portfolios
  },
];

/**
 * Renders the application sidebar navigation and language switcher.
 */
export default function Sidebar() {
  const location = useLocation();
  const { t } = useI18n();

  return (
    <aside className="w-64 bg-background border-e border-border h-screen flex flex-col">
      {/* Navigation Menu */}
      <nav className="flex-1 px-3 py-6 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;

          return (
            <Link
              key={item.href}
              to={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-[6px] text-base font-medium transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary border-s-2 border-primary"
                  : "text-muted-foreground hover:bg-card hover:text-foreground border-s-2 border-transparent"
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span>{t(item.i18nKey)}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer / Settings */}
      <div className="p-4 border-t border-border">
        <LanguageSwitcher />
        {/* Free-tier attribution link required by https://www.logo.dev/ when no
            paid plan is in place. Renders as a tiny muted text link so it
            stays out of the way visually but is always discoverable. */}
        <a
          href={getLogoDevAttributionUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block text-[10px] text-muted-foreground hover:text-foreground transition-colors tracking-wide uppercase opacity-70 hover:opacity-100"
          aria-label={t("attribution.logoDevAria")}
        >
          {t("attribution.logoDev")}
        </a>
      </div>
    </aside>
  );
}
