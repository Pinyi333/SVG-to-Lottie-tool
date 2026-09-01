import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { en, type Dictionary } from './en.js';
import { zhTW } from './zh-TW.js';

export type Locale = 'en' | 'zh-TW';

const DICTIONARIES: Record<Locale, Dictionary> = { en, 'zh-TW': zhTW };
const STORAGE_KEY = 'svgmotion.locale';

export const LOCALE_LABELS: Record<Locale, string> = { en: 'English', 'zh-TW': '繁體中文' };

/**
 * Picks a starting locale from what the visitor previously chose, then from
 * the browser's languages. Anything unrecognised falls back to English.
 */
function initialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'zh-TW') return stored;
  } catch {
    // Storage can be unavailable in private mode; the default is fine.
  }

  for (const language of navigator.languages ?? []) {
    if (/^zh\b/i.test(language)) return 'zh-TW';
    if (/^en\b/i.test(language)) return 'en';
  }
  return 'en';
}

interface I18nValue {
  locale: Locale;
  setLocale(locale: Locale): void;
  t: Dictionary;
  /** Substitutes `{name}` placeholders in a translated string. */
  format(template: string, values: Record<string, string | number>): string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    document.documentElement.lang = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // A remembered preference is a convenience, not a requirement.
    }
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale,
      t: DICTIONARIES[locale],
      format: (template, values) =>
        template.replace(/\{(\w+)\}/g, (match, key: string) =>
          key in values ? String(values[key]) : match,
        ),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside an I18nProvider.');
  return value;
}
