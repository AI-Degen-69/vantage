import { Link, useLocation } from "react-router-dom";
import { BarChart3, List, TrendingUp, Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./LanguageSwitcher";

const navItems = [
  {
    i18nKey: "sidebar.insights",
    href: "/insights",
    icon: BarChart3,
  },
  {
    i18nKey: "sidebar.watchlists",
    href: "/watchlists",
    icon: List,
  },
  {
    i18nKey: "sidebar.charts",
    href: "/charts",
    icon: TrendingUp,
  },
  {
    i18nKey: "sidebar.earnings",
    href: "/earnings",
    icon: Calendar,
  },
  {
    i18nKey: "sidebar.portfolios",
    href: "/portfolios",
    icon: List, // Temporary icon for portfolios
  },
];

/**
 * Renders the application sidebar navigation and language switcher.
 */
export default function Sidebar() {
  const location = useLocation();
  const { t } = useTranslation();

  return (
    <aside className="w-64 bg-slate-900 border-e border-slate-800 h-screen flex flex-col">
      {/* Navigation Menu */}
      <nav className="flex-1 px-3 py-6 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;

          return (
            <Link
              key={item.href}
              to={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-white text-base font-medium transition-colors ${
                isActive
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "hover:bg-slate-800"
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span>{t(item.i18nKey)}</span>
            </Link>
          );
        })}
      </nav>
      
      {/* Footer / Settings */}
      <div className="p-4 border-t border-slate-800">
        <LanguageSwitcher />
      </div>
    </aside>
  );
}
