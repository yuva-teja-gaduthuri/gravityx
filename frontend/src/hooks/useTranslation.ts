'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { translations, Language } from '../utils/translations';
import { getApiUrl } from '../utils/api';

export function useTranslation() {
  const { user, refreshProfile } = useAuth(false);
  const [currentLanguage, setCurrentLanguageState] = useState<Language>('en');

  // Helper to determine the active language
  const getActiveLanguage = useCallback((): Language => {
    if (typeof window !== 'undefined') {
      if (user && user.language) {
        return user.language as Language;
      }
      const localLang = localStorage.getItem('gravityx_setting_language');
      if (localLang === 'en' || localLang === 'te' || localLang === 'hi') {
        return localLang as Language;
      }
    }
    return 'en';
  }, [user]);

  // Sync state with active profile/settings
  useEffect(() => {
    setCurrentLanguageState(getActiveLanguage());
  }, [getActiveLanguage, user]);

  // Listen to global updates
  useEffect(() => {
    const handleSync = () => {
      setCurrentLanguageState(getActiveLanguage());
    };

    window.addEventListener('gravityx_user_updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('gravityx_user_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [getActiveLanguage]);

  // Translation function
  const t = useCallback(
    (key: string, fallbackText?: string): string => {
      const langTranslations = translations[currentLanguage];
      if (langTranslations && langTranslations[key] !== undefined) {
        return langTranslations[key];
      }
      // Fallback to English if translation is missing
      const enTranslations = translations['en'];
      if (enTranslations && enTranslations[key] !== undefined) {
        return enTranslations[key];
      }
      return fallbackText || key;
    },
    [currentLanguage]
  );

  // Set new language
  const setLanguage = useCallback(
    async (lang: Language) => {
      if (typeof window === 'undefined') return;

      localStorage.setItem('gravityx_setting_language', lang);
      setCurrentLanguageState(lang);

      const token = localStorage.getItem('gravityx_token');
      if (token && user) {
        try {
          const res = await fetch(getApiUrl('/api/auth/profile'), {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ language: lang }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.user) {
              localStorage.setItem('gravityx_user', JSON.stringify(data.user));
            }
          }
        } catch (err) {
          console.error('Failed to sync language settings with backend:', err);
        }
      }

      // Dispatch events to notify other hooks
      window.dispatchEvent(new Event('gravityx_user_updated'));
      refreshProfile();
    },
    [user, refreshProfile]
  );

  return {
    t,
    currentLanguage,
    setLanguage,
  };
}
