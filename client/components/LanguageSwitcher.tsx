import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const currentLang = i18n.resolvedLanguage || 'en';

  const switchLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="flex items-center justify-center p-1 bg-slate-950/50 rounded-full border border-slate-800 shadow-inner overflow-hidden rtl:flex-row-reverse relative">
      <button
        onClick={() => switchLanguage("en")}
        className={cn(
          "relative flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-full transition-all duration-300 z-10",
          currentLang === "en"
            ? "text-white shadow-sm"
            : "text-slate-400 hover:text-slate-200"
        )}
        dir="ltr"
      >
        <span className="text-base">🇺🇸</span>
        <span className="font-semibold tracking-wide">US</span>
      </button>

      <button
        onClick={() => switchLanguage("he")}
        className={cn(
          "relative flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-full transition-all duration-300 z-10",
          currentLang === "he"
            ? "text-white shadow-sm"
            : "text-slate-400 hover:text-slate-200"
        )}
        dir="rtl"
      >
        <span className="text-base">🇮🇱</span>
        <span className="font-semibold tracking-wide">עב</span>
      </button>

      {/* Animated Pill Background */}
      <div 
        className={cn(
          "absolute top-1 bottom-1 w-[calc(50%-4px)] bg-blue-600 rounded-full transition-transform duration-300 ease-out z-0",
          currentLang === "en" 
            ? "translate-x-0 rtl:translate-x-full left-1 rtl:left-auto rtl:right-1" 
            : "translate-x-full rtl:translate-x-0 left-1 rtl:left-auto rtl:right-1"
        )}
      />
    </div>
  );
}
