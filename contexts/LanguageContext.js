import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSettingsStore } from '../stores/useSettingsStore';
import i18n from '../utils/i18n';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const { language } = useSettingsStore();
  const [currentLanguage, setCurrentLanguage] = useState(language);

  useEffect(() => {
    // Update i18n locale and trigger re-render
    i18n.locale = language;
    setCurrentLanguage(language);
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language: currentLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

// Custom hook for translations that triggers re-render on language change
export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within LanguageProvider');
  }

  return {
    t: (key, options) => i18n.t(key, options),
    language: context.language,
  };
};

export default LanguageContext;
