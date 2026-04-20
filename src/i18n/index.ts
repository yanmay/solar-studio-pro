import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en";
import hi from "./locales/hi";
import mr from "./locales/mr";
import ta from "./locales/ta";
import bn from "./locales/bn";

export const SUPPORTED_LANGS = [
  { code: "en", label: "English",  native: "English" },
  { code: "hi", label: "Hindi",    native: "हिन्दी" },
  { code: "mr", label: "Marathi",  native: "मराठी" },
  { code: "ta", label: "Tamil",    native: "தமிழ்" },
  { code: "bn", label: "Bengali",  native: "বাংলা" },
] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      mr: { translation: mr },
      ta: { translation: ta },
      bn: { translation: bn },
    },
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGS.map((l) => l.code),
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      lookupLocalStorage: "sunpower-lang",
      caches: ["localStorage"],
    },
  });

export default i18n;
