import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { sessionApi, type SessionPlayer } from '../api/client'

const hm = (iso: string) =>
  new Date(iso).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })

export function StatsPanel({ sessionId, players }: { sessionId: string; players: SessionPlayer[] }) {
  const { t } = useTranslation()
  const [sortBy, setSortBy] = useState<'games' | 'minutes'>('games')

  const { data: games } = useQuery({
    queryKey: ['games', sessionId],
    queryFn: () => sessionApi.games(sessionId).then((r) => r.data.data),
    // WS invalidates ['games', sid] on every change; no polling needed
    enabled: !!sessionId,
  })

  const ranked = [...players].sort((a, b) =>
    sortBy === 'games'
      ? b.games - a.games || b.total_minutes - a.total_minutes
      : b.total_minutes - a.total_minutes || b.games - a.games
  )
  const maxVal = Math.max(1, ...ranked.map((p) => (sortBy === 'games' ? p.games : p.total_minutes)))

  const tab = (active: boolean) =>
    `px-3 py-1 rounded-full text-xs font-bold ${active ? 'bg-brand-pink text-white' : 'bg-gray-100 text-gray-500'}`

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <span className="font-bold text-gray-700">{t('StatsPanel.title')}</span>
        <div className="flex gap-1">
          <button onClick={() => setSortBy('games')} className={tab(sortBy === 'games')}>{t('StatsPanel.games')}</button>
          <button onClick={() => setSortBy('minutes')} className={tab(sortBy === 'minutes')}>{t('StatsPanel.minutes')}</button>
        </div>
      </div>

      {/* ranking bars */}
      <div className="space-y-1.5">
        {ranked.map((p, i) => {
          const val = sortBy === 'games' ? p.games : p.total_minutes
          const pct = Math.round((val / maxVal) * 100)
          return (
            <div key={p.player_id} className="flex items-center gap-2">
              <span className="w-4 text-xs text-gray-300 text-right">{i + 1}</span>
              <span className="w-14 truncate text-sm font-semibold text-gray-700">{p.display_name}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                <div className="h-full bg-brand-pink rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-12 text-right text-xs text-gray-500">
                {sortBy === 'games' ? t('StatsPanel.gamesCount', { n: p.games }) : t('StatsPanel.minutesCount', { n: p.total_minutes })}
              </span>
            </div>
          )
        })}
        {ranked.length === 0 && <p className="text-sm text-gray-300">{t('StatsPanel.empty')}</p>}
      </div>

      {/* per-game history */}
      <details>
        <summary className="cursor-pointer text-sm font-bold text-gray-600">
          {t('StatsPanel.history', { count: games?.length ?? 0 })}
        </summary>
        <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
          {(games ?? []).map((g) => (
            <div key={g.ended_at_id} className="text-sm border-b last:border-0 pb-2">
              <div className="flex justify-between text-gray-400 text-xs">
                <span>
                  {t('StatsPanel.court', { n: g.court_num })} · {g.started_at ? `${hm(g.started_at)}–` : ''}
                  {hm(g.ended_at)}
                </span>
                <span className="font-semibold text-gray-600">{t('StatsPanel.minutesCount', { n: g.minutes })}</span>
              </div>
              <div className="text-gray-700">{g.player_names.join('、') || '—'}</div>
            </div>
          ))}
          {(games ?? []).length === 0 && (
            <p className="text-sm text-gray-300">{t('StatsPanel.noHistory')}</p>
          )}
        </div>
      </details>
    </div>
  )
}
