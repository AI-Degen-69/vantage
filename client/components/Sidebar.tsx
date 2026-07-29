import { Link, useLocation } from "react-router-dom";
import { BarChart3, List, TrendingUp, Calendar } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Sidebar() {
  const location = useLocation();
  const { t } = useI18n();

  const navItems = [
    { label: t("nav.insights"), href: "/insights", icon: BarChart3 },
    { label: t("nav.watchlists"), href: "/watchlists", icon: List },
    { label: t("nav.charts"), href: "/charts", icon: TrendingUp },
    { label: t("nav.earnings"), href: "/earnings", icon: Calendar },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 h-screen flex flex-col">
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
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Language Switcher */}
      <div className="px-3 py-4 border-t border-slate-800">
        <LanguageSwitcher />
      </div>
    </aside>
  );
}
