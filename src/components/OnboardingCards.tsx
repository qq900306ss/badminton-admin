import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'

// 首次使用的翻頁式導覽(團主端):開團 → 收人 → 現場排點 → 收尾 4 張卡。
// 看完/略過記在 localStorage,之後可從「⚙️ 設定 → 📖 使用教學」重看。
export const ONBOARD_KEY = 'onboard_admin_v1'

const CARDS = [
  { emoji: '🎉', key: 'openGroup' },
  { emoji: '🙋', key: 'collect' },
  { emoji: '📋', key: 'onsite' },
  { emoji: '💰', key: 'fees' },
]

export function OnboardingCards({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const [idx, setIdx] = useState(0)
  const [dir, setDir] = useState(1)
  const last = idx === CARDS.length - 1
  const card = CARDS[idx]
  // guard: if the translation is missing t() returns the key string — never
  // let that crash the whole app with .map-is-not-a-function
  const linesRaw = t(`OnboardingCards.${card.key}Lines`, { returnObjects: true })
  const lines = Array.isArray(linesRaw) ? (linesRaw as string[]) : []

  function go(next: number) {
    setDir(next > idx ? 1 : -1)
    setIdx(Math.max(0, Math.min(CARDS.length - 1, next)))
  }
  function finish() {
    localStorage.setItem(ONBOARD_KEY, '1')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-5 overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-300">{idx + 1} / {CARDS.length}</span>
          <button onClick={finish} className="text-xs text-gray-400 font-semibold">{t('OnboardingCards.skip')}</button>
        </div>

        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={idx}
            custom={dir}
            initial={{ opacity: 0, x: 40 * dir }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 * dir }}
            transition={{ duration: 0.18 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.4}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60 && !last) go(idx + 1)
              else if (info.offset.x > 60 && idx > 0) go(idx - 1)
            }}
            className="text-center space-y-3 min-h-[13rem] cursor-grab active:cursor-grabbing"
          >
            <motion.div
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              className="text-6xl"
            >
              {card.emoji}
            </motion.div>
            <h2 className="text-xl font-extrabold text-gray-800">{t(`OnboardingCards.${card.key}Title`)}</h2>
            {lines.map((l, i) => (
              <p key={i} className="text-sm text-gray-500 leading-relaxed">{l}</p>
            ))}
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-center gap-1.5">
          {CARDS.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              className={`h-2 rounded-full transition-all ${i === idx ? 'w-6 bg-brand-pink' : 'w-2 bg-gray-200'}`}
            />
          ))}
        </div>

        <div className="flex gap-2">
          {idx > 0 && (
            <button onClick={() => go(idx - 1)} className="btn-secondary px-4 text-sm">{t('OnboardingCards.prev')}</button>
          )}
          <button
            onClick={() => (last ? finish() : go(idx + 1))}
            className="btn-primary flex-1 text-sm"
          >
            {last ? t('OnboardingCards.finish') : t('OnboardingCards.next')}
          </button>
        </div>
      </div>
    </div>
  )
}
