import React, { createContext, useContext, useState } from "react";
import { TRANSLATIONS } from "../i18n/translations";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem("drishti360_lang") || "en");

  const setLang = (code) => {
    setLangState(code);
    localStorage.setItem("drishti360_lang", code);
  };

  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
