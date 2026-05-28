import { Link, useLocation } from "react-router-dom";
import { BarChart3, List, TrendingUp, Calendar } from "lucide-react";

const navItems = [
  {
    label: "Insights",
    href: "/insights",
    icon: BarChart3,
  },
  {
    label: "Watchlists",
    href: "/watchlists",
    icon: List,
  },
  {
    label: "Charts",
    href: "/charts",
    icon: TrendingUp,
  },
  {
    label: "Earnings",
    href: "/earnings",
    icon: Calendar,
  },
];

export default function Sidebar() {
  const location = useLocation();

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
    </aside>
  );
}
