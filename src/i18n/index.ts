import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Supported UI languages. zh-TW is the source language and the fallback.
export const SUPPORTED_LANGS = ['zh-TW', 'en', 'ja'] as const
export type Lang = (typeof SUPPORTED_LANGS)[number]

export const LANG_LABELS: Record<Lang, string> = {
  'zh-TW': '中文',
  en: 'English',
  ja: '日本語',
}

// Auto-collect every locale fragment under ./locales named
// "<namespace>.<lang>.json" (e.g. AdminPage.en.json). Each translation lives in
// its own component-scoped fragment file so the code can be split across many
// contributors/agents without ever editing a shared JSON — the fragments are
// deep-merged here at build time into one resource bundle per language.
const modules = import.meta.glob('./locales/*.json', { eager: true }) as Record<
  string,
  { default: Record<string, unknown> }
>

type Bundle = Record<string, unknown>
const resources: Record<Lang, { translation: Bundle }> = {
  'zh-TW': { translation: {} },
  en: { translation: {} },
  ja: { translation: {} },
}

function deepMerge(target: Bundle, source: Bundle): Bundle {
  for (const [key, val] of Object.entries(source)) {
    if (
      val &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      typeof target[key] === 'object' &&
      target[key] &&
      !Array.isArray(target[key])
    ) {
      deepMerge(target[key] as Bundle, val as Bundle)
    } else {
      target[key] = val
    }
  }
  return target
}

for (const [path, mod] of Object.entries(modules)) {
  const m = path.match(/\/[^/]+\.(zh-TW|en|ja)\.json$/)
  if (!m) continue
  const lang = m[1] as Lang
  deepMerge(resources[lang].translation, mod.default)
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'zh-TW',
    supportedLngs: SUPPORTED_LANGS as unknown as string[],
    nonExplicitSupportedLngs: true, // treat en-US, ja-JP, zh-Hant… as their base
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'lang',
      caches: ['localStorage'],
    },
  })

// keep <html lang> in sync so the browser / a11y tools pick the right language
const setHtmlLang = (lng: string) => {
  document.documentElement.lang = lng
}
setHtmlLang(i18n.language)
i18n.on('languageChanged', setHtmlLang)

export default i18n
