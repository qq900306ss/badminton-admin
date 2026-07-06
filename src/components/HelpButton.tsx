import { useState } from 'react'
import { useTranslation } from 'react-i18next'

// 團主使用教學 — step-by-step illustrated guide, always available in-app.
const STEP_ICONS = ['🎉', '📲', '🧑‍🤝‍🧑', '🏸', '🔚', '👪', '🏷️', '🎊']

export function HelpButton({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const STEPS = STEP_ICONS.map((icon, i) => ({
    icon,
    title: t(`HelpButton.step${i + 1}Title`),
    body: t(`HelpButton.step${i + 1}Body`),
  }))
  return (
    <>
      <button onClick={() => setOpen(true)} className={className || 'text-xs text-gray-400'}>
        {t('HelpButton.button')}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-5"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-3xl p-5 w-full max-w-sm max-h-[82vh] overflow-y-auto space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-gray-800">{t('HelpButton.title')}</span>
              <button onClick={() => setOpen(false)} className="text-gray-400 font-bold">✕</button>
            </div>
            {STEPS.map((s, i) => (
              <div key={i} className="flex gap-3 items-start bg-gray-50 rounded-2xl px-3 py-2.5">
                <span className="text-2xl shrink-0">{s.icon}</span>
                <div>
                  <p className="text-sm font-bold text-gray-700">
                    {i + 1}. {s.title}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
