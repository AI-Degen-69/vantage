import { useI18n } from "@/lib/i18n";
import { Languages } from "lucide-react";

export default function LanguageSwitcher() {
  const { lang, setLang } = useI18n();

  return (
    <button
      onClick={() => setLang(lang === "en" ? "he" : "en")}
      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-foreground hover:bg-slate-700/50 transition-all border border-transparent hover:border-slate-600"
      title={lang === "en" ? "Switch to Hebrew" : "עברית לאנגלית"}
    >
      <Languages className="w-3.5 h-3.5" />
      <span>{lang === "en" ? "ע" : "En"}</span>
    </button>
  );
}
