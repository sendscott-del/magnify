import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { translations, Language, TranslationKey } from '../constants/translations';
import { translateCallingName, translateOrgName } from '../constants/callingNames';
import { supabase } from '../lib/supabase';

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  /** Calling name as stored (English free text) → display text in the current language. */
  tc: (callingName: string | null | undefined) => string;
  /** Calling-picker organization header (CALLING_GROUPS[].org) in the current language. */
  tOrg: (org: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => key,
  tc: (name) => name ?? '',
  tOrg: (org) => org,
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

  const tc = useCallback((name: string | null | undefined): string => translateCallingName(name, language), [language]);
  const tOrg = useCallback((org: string): string => translateOrgName(org, language), [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, tc, tOrg }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
