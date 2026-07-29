import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enTranslations from "../locales/en/translation.json";
import heTranslations from "../locales/he/translation.json";

// The translations
const resources = {
  en: {
    translation: enTranslations,
  },
  he: {
    translation: heTranslations,
  },
};

i18n
  // detect user language
  .use(LanguageDetector)
  // pass the i18n instance to react-i18next.
  .use(initReactI18next)
  // init i18next
  .init({
    resources,
    fallbackLng: "en",
    debug: false,
    
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
  });

// Handle document direction (RTL/LTR)
i18n.on('languageChanged', (lng) => {
  document.documentElement.dir = i18n.dir(lng);
  document.documentElement.lang = lng;
});

// Set initial direction
document.documentElement.dir = i18n.dir();
document.documentElement.lang = i18n.resolvedLanguage || 'en';

export default i18n;
