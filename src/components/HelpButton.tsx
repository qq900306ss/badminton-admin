import { useState } from 'react'

// 團主使用教學 — step-by-step illustrated guide, always available in-app.
const STEPS: { icon: string; title: string; body: string }[] = [
  { icon: '🎉', title: '開新團', body: '在首頁填:開團名稱、縣市/區、進場密碼、日期與時間、球場數,按「開團」。' },
  { icon: '📲', title: '邀請臨打人', body: '進場次頁,上方有 QR 與「複製連結」分享給大家;「海報模式」可放門口讓人掃。' },
  { icon: '🧑‍🤝‍🧑', title: '本場人員', body: '看到誰報到了(●已到)。點任一人可改名、改程度、標記「💰臨打費」、或斷開。' },
  { icon: '🏸', title: '排點上場', body: '球場卡「手動加人」把人排上場/排隊;沒帶手機的人用「現場排點板」代排。進行中(滿4人)不能換,要先「結束這場」。' },
  { icon: '🔚', title: '結束 / 還原', body: '一場打完點「結束這場」換下一組;誤按了 10 分鐘內可「還原」。' },
  { icon: '👪', title: '核准家人', body: '臨打人帶家人會出現「待核准」標記,點他按「核准」後才能被排上場。' },
  { icon: '🏷️', title: '改開團名稱', body: '場次頁最上方點標題(✏️)即可改名,臨打人看到的名字會立即更新。' },
  { icon: '🎊', title: '散場總結', body: '右上「總結」看每個人打了幾場、幾分鐘;「結束開團」收團。' },
]

export function HelpButton({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)} className={className || 'text-xs text-gray-400'}>
        ❓ 使用教學
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
              <span className="font-extrabold text-gray-800">🧑‍🏫 團主使用教學</span>
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
