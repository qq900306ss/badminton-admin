import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { sessionApi, type SessionPlayer } from '../api/client'

interface Props {
  sessionId: string
  title: string
  players: SessionPlayer[]
  onClose: () => void
}

export function SessionSummary({ sessionId, title, players, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  const { data: games } = useQuery({
    queryKey: ['games', sessionId],
    queryFn: () => sessionApi.games(sessionId).then((r) => r.data.data),
  })

  const totalGames = games?.length ?? 0
  const totalMin = (games ?? []).reduce((s, g) => s + (g.minutes || 0), 0)
  const ranked = [...players]
    .filter((p) => p.games > 0)
    .sort((a, b) => b.games - a.games || b.total_minutes - a.total_minutes)
  const top = ranked[0]

  function shareText() {
    const lines = [
      `🏸 ${title || '羽球揪團'} 散場總結`,
      `打了 ${totalGames} 場、共 ${totalMin} 分鐘`,
      ...ranked.slice(0, 5).map((p, i) => `${['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i]} ${p.display_name} ${p.games} 場 / ${p.total_minutes} 分`),
    ]
    return lines.join('\n')
  }

  async function share() {
    const text = shareText()
    try {
      if (navigator.share) {
        await navigator.share({ text })
      } else {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }
    } catch {
      /* user cancelled */
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6 space-y-4">
        <div className="text-center">
          <div className="text-4xl mb-1">🎉</div>
          <h2 className="text-xl font-extrabold text-gray-800">{title || '羽球揪團'} · 散場總結</h2>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: '總場次', value: totalGames, emoji: '🏸' },
            { label: '總時數(分)', value: totalMin, emoji: '⏱' },
            { label: '人數', value: players.length, emoji: '🧑‍🤝‍🧑' },
          ].map((s) => (
            <div key={s.label} className="bg-brand-bg rounded-2xl py-3">
              <div className="text-xl">{s.emoji}</div>
              <div className="text-2xl font-extrabold text-gray-800">{s.value}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>

        {top && (
          <div className="bg-brand-yellow/40 rounded-2xl py-3 text-center">
            <span className="text-sm text-amber-700 font-semibold">🏆 今日最猛 </span>
            <span className="font-extrabold text-gray-800">{top.display_name}</span>
            <span className="text-sm text-amber-700"> · {top.games} 場</span>
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-sm font-bold text-gray-600">排行(依場數)</p>
          {ranked.map((p, i) => (
            <div key={p.player_id} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">
                <span className="text-gray-400 mr-1">{i + 1}.</span>
                {p.display_name}
              </span>
              <span className="text-gray-500">{p.games} 場 · {p.total_minutes} 分</span>
            </div>
          ))}
          {ranked.length === 0 && <p className="text-sm text-gray-300">這場還沒有完成的場次</p>}
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={share} className="btn-primary flex-1">
            {copied ? '✓ 已複製' : '📤 分享到 LINE / 群組'}
          </button>
          <button onClick={onClose} className="btn-secondary px-5">關閉</button>
        </div>
      </div>
    </div>
  )
}
