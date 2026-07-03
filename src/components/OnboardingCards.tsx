import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// 首次使用的翻頁式導覽(團主端):開團 → 收人 → 現場排點 → 收尾 4 張卡。
// 看完/略過記在 localStorage,之後可從「⚙️ 設定 → 📖 使用教學」重看。
export const ONBOARD_KEY = 'onboard_admin_v1'

const CARDS = [
  {
    emoji: '🎉',
    title: '開團',
    lines: [
      '填名稱、地點、時間、密碼,30 秒開一團。',
      '開完拿 QR Code / 連結貼到 LINE 群、FB 社團,球友掃了就能進;團簡介和聯繫連結會顯示在大廳。',
    ],
  },
  {
    emoji: '🙋',
    title: '收人',
    lines: [
      '知道密碼的人直接進,不用審核。',
      '打開「前台報名」後沒密碼的人也能報名(可留言、可帶家人),你在「臨打報名審核」區一個個核准;可設收人名額,滿了照樣收單、由你挑人。',
    ],
  },
  {
    emoji: '📋',
    title: '現場排點',
    lines: [
      '每個場地卡看得到場上/排隊,可以代排、踢人、跨場交換排隊的人。',
      '開「公平讓分」會自動擋打太多的人,讓打少的有得打;結束按錯 10 分鐘內可還原。',
    ],
  },
  {
    emoji: '💰',
    title: '收費與統計',
    lines: [
      '成員可標「已收臨打費」,一鍵過濾誰還沒繳。',
      '每個人打幾場、多少分鐘自動統計;你做過的操作都有紀錄可查,結團後歷史保留。',
    ],
  },
]

export function OnboardingCards({ onClose }: { onClose: () => void }) {
  const [idx, setIdx] = useState(0)
  const [dir, setDir] = useState(1)
  const last = idx === CARDS.length - 1
  const card = CARDS[idx]

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
          <button onClick={finish} className="text-xs text-gray-400 font-semibold">略過 ✕</button>
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
            <h2 className="text-xl font-extrabold text-gray-800">{card.title}</h2>
            {card.lines.map((l, i) => (
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
            <button onClick={() => go(idx - 1)} className="btn-secondary px-4 text-sm">上一頁</button>
          )}
          <button
            onClick={() => (last ? finish() : go(idx + 1))}
            className="btn-primary flex-1 text-sm"
          >
            {last ? '開團去 🏸' : '下一頁 →'}
          </button>
        </div>
      </div>
    </div>
  )
}
