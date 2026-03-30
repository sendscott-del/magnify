import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { translations, Language, TranslationKey } from '../constants/translations';
import { supabase } from '../lib/supabase';

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

function saveLanguageLocal(lang: Language) {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(STORAGE_KEY, lang);
    }
  } catch {}
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(loadLanguage());

  // Sync language from the authenticated user's profile
  useEffect(() => {
    async function syncFromProfile(userId: string) {
      const { data } = await supabase
        .from('profiles')
        .select('language')
        .eq('id', userId)
        .single();
      const lang = data?.language;
      if (lang === 'en' || lang === 'es') {
        setLanguageState(lang);
        saveLanguageLocal(lang);
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) syncFromProfile(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) syncFromProfile(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang);
    saveLanguageLocal(lang);
    // Persist to the user's profile if authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      supabase.from('profiles').update({ language: lang }).eq('id', session.user.id).then(() => {});
    }
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
