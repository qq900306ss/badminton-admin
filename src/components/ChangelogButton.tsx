import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getChangelog } from '../lib/changelog'

// A button that opens a「更新資訊」modal listing recent changes, so users can see
// what's new whenever they want.
export function ChangelogButton({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)} className={className || 'text-xs text-gray-400'}>
        {t('ChangelogButton.button')}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-3xl p-5 w-full max-w-sm max-h-[80vh] overflow-y-auto space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-gray-800">{t('ChangelogButton.title')}</span>
              <button onClick={() => setOpen(false)} className="text-gray-400 font-bold">
                ✕
              </button>
            </div>
            {getChangelog().map((entry) => (
              <div key={entry.date} className="space-y-1.5">
                <p className="text-xs font-bold text-brand-pink">{entry.date}</p>
                <ul className="space-y-1">
                  {entry.items.map((it, i) => (
                    <li key={i} className="text-sm text-gray-600 flex gap-2">
                      <span className="text-brand-pink">•</span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
