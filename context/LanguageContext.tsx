import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { translations, Language, TranslationKey } from '../constants/translations';

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => key,
});

const STORAGE_KEY = 'magnify_language';

function loadLanguage(): Language {
  try {
    if (Platform.OS === 'web') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'es') return saved;
    }
  } catch {}
  return 'en';
}

function saveLanguage(lang: Language) {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(STORAGE_KEY, lang);
    }
  } catch {}
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    setLanguageState(loadLanguage());
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    saveLanguage(lang);
  }, []);

  const t = useCallback((key: TranslationKey): string => {
    return (translations[language] as Record<string, string>)[key]
      ?? (translations.en as Record<string, string>)[key]
      ?? key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
