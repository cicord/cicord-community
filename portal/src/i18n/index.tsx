import { createContext, useContext, useEffect, type ReactNode } from "react";
import { en, type Messages } from "./en.ts";

export type { Messages };

/**
 * Interface languages. The community speaks English (`spec.portal.locale: en`); a language
 * is added with one file typed `Messages` (see en.ts) and one entry here.
 */
const messages: Record<string, Messages> = { en };

/** `spec.portal.locale` when set and supported, else the browser language, else English. */
export function pickLocale(serverLocale?: string): string {
  if (serverLocale && messages[serverLocale]) return serverLocale;
  const nav = typeof navigator === "undefined" ? [] : (navigator.languages ?? [navigator.language]);
  for (const l of nav) {
    const short = l?.slice(0, 2).toLowerCase();
    if (short && messages[short]) return short;
  }
  return "en";
}

const I18nContext = createContext<Messages>(en);

export function I18nProvider({ locale, children }: { locale: string; children: ReactNode }) {
  const value = messages[locale] ?? en;
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): Messages {
  return useContext(I18nContext);
}
