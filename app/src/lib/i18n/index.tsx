import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isLang, translate, type Lang, type MessageKey } from "./translate";

export { isLang, translate };
export type { Lang, MessageKey };

/** Kept when the user logs out, so the chosen language survives a new session. */
export const LANG_STORAGE_KEY = "onboardie.lang";

type Vars = Record<string, string | number>;

type LangContextValue = { lang: Lang; setLang: (lang: Lang) => void };

const LangContext = createContext<LangContextValue>({ lang: "en", setLang: () => {} });

/**
 * English is the default. German is used only after someone picks it; the choice
 * is remembered in this browser. The server always renders English, and the
 * stored choice is applied right after the page loads.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
      if (isLang(stored)) setLangState(stored);
    } catch {
      /* storage may be unavailable */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      /* storage may be unavailable */
    }
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

/** `t("nav.dashboard")`, plus the active language and its date locale. */
export function useT() {
  const { lang, setLang } = useContext(LangContext);
  const t = useCallback((key: MessageKey, vars?: Vars) => translate(lang, key, vars), [lang]);
  return { t, lang, setLang, locale: lang === "de" ? "de-DE" : "en-GB" };
}
