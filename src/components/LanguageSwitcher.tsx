import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGS, LANG_LABELS, type Lang } from '../i18n'

// Floating language picker. Fixed so it's reachable from every page/screen
// without threading a header prop through each route.
export function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = (SUPPORTED_LANGS as readonly string[]).includes(i18n.language)
    ? (i18n.language as Lang)
    : 'zh-TW'

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    // bottom-left so it never covers page headers (they keep their own
    // top-right actions like 設定/登出); the menu opens upward.
    <div ref={ref} className="fixed bottom-4 left-4 z-[60]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-full bg-white/90 backdrop-blur px-3 py-1.5
          text-xs font-bold text-gray-600 shadow border border-gray-200 active:scale-95 transition-transform"
        aria-label="Language"
      >
        🌐 {LANG_LABELS[current]}
      </button>
      {open && (
        <div className="absolute left-0 bottom-full mb-1 w-32 rounded-2xl bg-white shadow-lg border border-gray-100 overflow-hidden">
          {SUPPORTED_LANGS.map((lng) => (
            <button
              key={lng}
              onClick={() => {
                i18n.changeLanguage(lng)
                setOpen(false)
              }}
              className={`block w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors
                ${lng === current ? 'bg-brand-bg text-violet-600' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {LANG_LABELS[lng]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
