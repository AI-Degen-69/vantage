import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

// ── Translations ──────────────────────────────────────────────────────────────

const en = {
  // Common
  "app.name": "Vantage",
  "loading": "Loading...",
  "error.generic": "Something went wrong",
  "source.yahoo": "Yahoo Finance",
  "source.finnhub": "Finnhub",

  // Sidebar
  "nav.insights": "Insights",
  "nav.watchlists": "Watchlists",
  "nav.charts": "Charts",
  "nav.earnings": "Earnings",

  // Insights page
  "insights.title": "Insights",
  "insights.search_placeholder": "Search by symbol or company name...",
  "insights.filter.all_sectors": "All Sectors",
  "insights.filter.all_caps": "All Caps",
  "insights.filter.mega": "Mega $200B+",
  "insights.filter.large": "Large $10B+",
  "insights.filter.mid": "Mid $2B+",
  "insights.filter.small": "Small <$2B",
  "insights.filter.all_moves": "All Moves",
  "insights.filter.gainers": "Gainers >+1%",
  "insights.filter.losers": "Losers <-1%",
  "insights.filter.big_movers": "Big Movers >±5%",
  "insights.filter.flat": "Flat ±0.5%",
  "insights.filter.clear": "Clear",
  "insights.filter.stocks_count": "{{count}} stocks",
  "insights.filter.stocks_of": "{{filtered}} of {{total}} stocks",
  "insights.spotlight.title": "SECTOR SPOTLIGHT",
  "insights.spotlight.sectors": "{{count}} sectors",
  "insights.loading": "Loading real-time quotes from Yahoo Finance...",
  "insights.error.title": "Failed to load stock data",
  "insights.error.desc": "The Yahoo Finance API may be rate-limited. Try again in a moment.",
  "insights.empty.title": "No stocks match your filters",
  "insights.empty.desc": "Try adjusting your search or filter criteria",
  "insights.empty.clear": "Clear all filters",
  "insights.market_cap": "Market Cap:",

  // Insights tabs
  "insights.tab.sp500": "S&P 500",
  "insights.tab.trending": "Most Trending",
  "insights.tab.growth": "Growth",
  "insights.tab.dividend": "Dividend Growth",
  "insights.tab.buyback": "Buyback Machines",
  "insights.tab.ai": "Artificial Intelligence",
  "insights.tab.cloud": "Cloud",
  "insights.tab.ev": "Electric Vehicles",
  "insights.tab.leisure": "Leisure and Entertainment",

  // Earnings page
  "earnings.title": "Earnings Calendar",
  "earnings.loading": "Loading earnings calendar from Finnhub...",
  "earnings.error.title": "Failed to load earnings calendar",
  "earnings.error.desc": "Finnhub API may be rate-limited. Try again in a moment.",
  "earnings.empty.title": "No earnings reports this week",
  "earnings.empty.desc": "Try a different week or check back closer to the date",
  "earnings.today": "Today",
  "earnings.week": "Week",
  "earnings.total_reports": "Total Reports",
  "earnings.before_open": "Before Open",
  "earnings.after_close": "After Close",
  "earnings.view_week": "Week View",
  "earnings.view_list": "List View",
  "earnings.reports": "{{count}} reports",
  "earnings.report": "{{count}} report",
  "earnings.bmo": "BMO",
  "earnings.amc": "AMC",
  "earnings.other": "Other",
  "earnings.eps_est": "EPS Est:",
  "earnings.eps_act": "EPS Act:",
  "earnings.surprise": "Surprise:",
  "earnings.rev_est": "Rev Est:",
  "earnings.rev_act": "Rev Act:",
  "earnings.est": "Est:",
  "earnings.midday": "Midday",

  // Slide-over
  "slideover.loading": "Loading data...",
  "slideover.error.title": "Failed to load data",
  "slideover.error.desc": "The API may be rate-limited",
  "slideover.key_ratios": "Key Ratios",
  "slideover.quick_stats": "Quick Stats",
  "slideover.about": "About",
  "slideover.view_full": "View full stock page",
  "slideover.after_hrs": "After hrs:",

  // Language
  "language.en": "English",
  "language.he": "עברית",
};

const he: Record<string, string> = {
  "app.name": "Vantage",
  "loading": "טוען...",
  "error.generic": "משהו השתבש",
  "source.yahoo": "Yahoo Finance",
  "source.finnhub": "Finnhub",

  "nav.insights": "תובנות",
  "nav.watchlists": "רשימות מעקב",
  "nav.charts": "גרפים",
  "nav.earnings": "דוחות",

  "insights.title": "תובנות",
  "insights.search_placeholder": "חיפוש לפי סימבול או שם חברה...",
  "insights.filter.all_sectors": "כל הענפים",
  "insights.filter.all_caps": "כל הגדלים",
  "insights.filter.mega": "ענק $200B+",
  "insights.filter.large": "גדול $10B+",
  "insights.filter.mid": "בינוני $2B+",
  "insights.filter.small": "קטן <$2B",
  "insights.filter.all_moves": "כל התנועות",
  "insights.filter.gainers": "עליות >+1%",
  "insights.filter.losers": "ירידות <-1%",
  "insights.filter.big_movers": "תנודות >±5%",
  "insights.filter.flat": "יציב ±0.5%",
  "insights.filter.clear": "נקה",
  "insights.filter.stocks_count": "{{count}} מניות",
  "insights.filter.stocks_of": "{{filtered}} מתוך {{total}} מניות",
  "insights.spotlight.title": "תמונה ענפית",
  "insights.spotlight.sectors": "{{count}} ענפים",
  "insights.loading": "טוען נתונים חיים מ-Yahoo Finance...",
  "insights.error.title": "טעינת נתוני המניות נכשלה",
  "insights.error.desc": "ייתכן ש-API של Yahoo Finance הוגבל. נסה שוב בעוד רגע.",
  "insights.empty.title": "אין מניות שתואמות לסינון",
  "insights.empty.desc": "נסה לשנות את מונחי החיפוש או הסינון",
  "insights.empty.clear": "נקה את כל הסינונים",
  "insights.market_cap": "שווי שוק:",

  "insights.tab.sp500": "S&P 500",
  "insights.tab.trending": "הכי חם",
  "insights.tab.growth": "צמיחה",
  "insights.tab.dividend": "דיבידנד",
  "insights.tab.buyback": "רכישה חוזרת",
  "insights.tab.ai": "בינה מלאכותית",
  "insights.tab.cloud": "ענן",
  "insights.tab.ev": "רכב חשמלי",
  "insights.tab.leisure": "בידור ופנאי",

  "earnings.title": "לוח דוחות",
  "earnings.loading": "טוען דוחות מ-Finnhub...",
  "earnings.error.title": "טעינת לוח הדוחות נכשלה",
  "earnings.error.desc": "ייתכן ש-API של Finnhub הוגבל. נסה שוב בעוד רגע.",
  "earnings.empty.title": "אין דוחות השבוע",
  "earnings.empty.desc": "נסה שבוע אחר או בדוק שוב קרוב לתאריך",
  "earnings.today": "היום",
  "earnings.week": "שבוע",
  "earnings.total_reports": "סהכ דוחות",
  "earnings.before_open": "לפני הפתיחה",
  "earnings.after_close": "אחרי הסגירה",
  "earnings.view_week": "תצוגה שבועית",
  "earnings.view_list": "תצוגת רשימה",
  "earnings.reports": "{{count}} דוחות",
  "earnings.report": "{{count}} דוח",
  "earnings.bmo": "לפני פתיחה",
  "earnings.amc": "אחרי סגירה",
  "earnings.other": "אחר",
  "earnings.eps_est": "EPS צפוי:",
  "earnings.eps_act": "EPS בפועל:",
  "earnings.surprise": "הפתעה:",
  "earnings.rev_est": "הכנסה צפויה:",
  "earnings.rev_act": "הכנסה בפועל:",
  "earnings.est": "צפי:",
  "earnings.midday": "צהריים",

  "slideover.loading": "טוען נתונים...",
  "slideover.error.title": "טעינת הנתונים נכשלה",
  "slideover.error.desc": "ייתכן שה-API הוגבל",
  "slideover.key_ratios": "יחסים מרכזיים",
  "slideover.quick_stats": "סטטיסטיקות מהירות",
  "slideover.about": "אודות",
  "slideover.view_full": "לעמוד המניה המלא",
  "slideover.after_hrs": "אחרי שעות:",

  "language.en": "English",
  "language.he": "עברית",
};

// ── Types ──────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "vantage-language";
type Lang = "en" | "he";

interface I18nContextValue {
  lang: Lang;
  t: (key: string, vars?: Record<string, string | number>) => string;
  setLang: (lang: Lang) => void;
  dir: "ltr" | "rtl";
}

// ── Context ────────────────────────────────────────────────────────────────────

const I18nContext = createContext<I18nContextValue>({
  lang: "en",
  t: (key: string) => key,
  setLang: () => {},
  dir: "ltr",
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "en" || stored === "he") return stored;
      // Check browser language
      const browserLang = navigator.language?.slice(0, 2);
      if (browserLang === "he") return "he";
    }
    return "en";
  });

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, newLang);
      document.documentElement.dir = newLang === "he" ? "rtl" : "ltr";
      document.documentElement.lang = newLang;
    }
  }, []);

  // Apply dir/lang on mount
  useEffect(() => {
    document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  const dictionary = lang === "he" ? he : en;

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      let value = dictionary[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          value = value.replace(`{{${k}}}`, String(v));
        }
      }
      return value;
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, t, setLang, dir: lang === "he" ? "rtl" : "ltr" }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
