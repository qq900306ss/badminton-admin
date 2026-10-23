import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CourtView, PlayerSlot } from '../../api/client'
import { Avatar } from './Sheet'

// 一面場 = 一張畫成羽球場的卡:綠色場地、中間一條網、雙打四個站位。
// 團主一眼看出「誰在打、打多久、下一組是誰」,最常按的「結束・換下一組」放在卡片最下面(拇指區)。

function useMinutes(startedAt?: string, stopAt?: string) {
  const [now, setNow] = useState(() => Date.now()) // 每 15 秒跳一次,render 保持純
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [])
  if (!startedAt) return null
  const stop = stopAt ? new Date(stopAt).getTime() : NaN
  const end = Number.isNaN(stop) ? now : Math.min(now, stop) // 過了團的結束時間就停住
  const ms = end - new Date(startedAt).getTime()
  return ms < 0 ? null : Math.floor(ms / 60000)
}

function Spot({ slot, onTap, onEmpty, align }: { slot: PlayerSlot; onTap: () => void; onEmpty: () => void; align: 'left' | 'right' }) {
  const { t } = useTranslation()
  if (!slot.player_id) {
    return (
      <button
        onClick={onEmpty}
        className="h-full w-full rounded-xl border-2 border-dashed border-white/50 text-white/80 text-xs font-bold flex flex-col items-center justify-center gap-0.5 active:bg-white/10"
      >
        <span className="text-lg leading-none">＋</span>
        {t('Manage.addHere')}
      </button>
    )
  }
  return (
    <button
      onClick={onTap}
      className={`h-full w-full flex items-center gap-2 px-2 rounded-xl active:bg-white/15 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}
    >
      <Avatar p={slot} />
      <span className="min-w-0">
        <span className="block text-[13px] font-extrabold text-white leading-tight truncate drop-shadow-sm">{slot.display_name}</span>
        <span className="block text-[10px] text-white/75 leading-tight">
          {slot.level > 0 ? `Lv${slot.level}` : ''}
          {slot.level > 0 ? ' · ' : ''}
          {t('Manage.gamesShort', { n: slot.games })}
        </span>
      </span>
    </button>
  )
}

export function CourtTile({
  court,
  stopAt,
  onEnd,
  onUndo,
  onMenu,
  onSlot,
  onAddPlaying,
  onAddQueue,
}: {
  court: CourtView
  stopAt?: string
  onEnd: () => void
  onUndo: () => void
  onMenu: () => void
  onSlot: (slot: PlayerSlot) => void // 點場上/排隊的人 → 這個人的操作
  onAddPlaying: () => void
  onAddQueue: () => void
}) {
  const { t } = useTranslation()
  const slots = [0, 1, 2, 3].map((i) => court.playing[i] ?? { player_id: '', display_name: '', level: 0, games: 0 })
  const filled = slots.filter((s) => s.player_id).length
  const mins = useMinutes(filled === 4 ? court.started_at : undefined, stopAt)
  const title = court.name?.trim() ? court.name : t('Manage.courtN', { n: court.court_num })
  const long = mins !== null && mins >= 20 // 打太久:提醒團主

  const status =
    filled === 4
      ? { text: t('Manage.playingMins', { n: mins ?? 0 }), cls: long ? 'bg-amber-300 text-amber-900' : 'bg-white text-emerald-700' }
      : filled > 0
        ? { text: t('Manage.gathering', { n: filled }), cls: 'bg-brand-yellow text-amber-800' }
        : { text: t('Manage.idle'), cls: 'bg-white/80 text-gray-500' }

  return (
    <div className={`rounded-[1.75rem] bg-white shadow-md overflow-hidden ${court.locked ? 'ring-2 ring-rose-300' : ''}`}>
      {/* 標題列 */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <span className="font-extrabold text-gray-800 text-[17px] truncate">{title}</span>
        {court.locked && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-600">🔒 {t('Manage.locked')}</span>}
        <span className="flex-1" />
        <button onClick={onMenu} aria-label={t('Manage.courtMenu')} className="w-9 h-9 -mr-1 rounded-full text-gray-400 text-xl leading-none active:bg-gray-100">
          ⋯
        </button>
      </div>

      {/* 場地 */}
      <div className="mx-3 rounded-2xl p-2 relative bg-gradient-to-b from-emerald-500 to-emerald-600 shadow-inner">
        <div className="absolute inset-2 rounded-xl border-2 border-white/40 pointer-events-none" />
        <div className="absolute left-1/2 top-2 bottom-2 w-0.5 -translate-x-1/2 bg-white/30 pointer-events-none" />
        <span className={`absolute z-10 left-1/2 -translate-x-1/2 top-[calc(50%-0.7rem)] text-[11px] font-extrabold px-2.5 py-0.5 rounded-full shadow ${status.cls}`}>
          {status.text}
        </span>
        <div className="grid grid-cols-2 grid-rows-2 gap-x-3 gap-y-6 relative">
          {/* 網子 */}
          <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 bg-white/90 rounded-full shadow pointer-events-none" />
          {slots.map((s, i) => (
            <div key={i} className="h-14">
              <Spot slot={s} align={i % 2 ? 'right' : 'left'} onTap={() => onSlot(s)} onEmpty={onAddPlaying} />
            </div>
          ))}
        </div>
      </div>

      {/* 下一組 */}
      <div className="px-4 pt-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-gray-400 shrink-0">{t('Manage.next', { n: court.queue.length })}</span>
          <div className="flex -space-x-1.5 overflow-x-auto py-1 min-w-0">
            {court.queue.map((q) => (
              <button key={q.player_id} onClick={() => onSlot(q)} title={q.display_name}>
                <Avatar p={q} size="sm" />
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-500 truncate min-w-0 flex-1">
            {court.queue.length ? court.queue.map((q) => q.display_name).join('、') : t('Manage.nobodyQueued')}
          </span>
          {court.queue.length < 4 && (
            <button onClick={onAddQueue} className="shrink-0 text-xs font-bold text-pink-600 bg-pink-50 rounded-full px-2.5 py-1 active:scale-95">
              ＋ {t('Manage.queueShort')}
            </button>
          )}
        </div>
      </div>

      {/* 主要動作 */}
      <div className="p-3 flex gap-2">
        {court.can_undo && (
          <button onClick={onUndo} className="shrink-0 px-3 rounded-2xl bg-amber-50 text-amber-700 text-sm font-bold active:scale-95" aria-label={t('Manage.undo')}>
            ↩
          </button>
        )}
        <button
          onClick={onEnd}
          disabled={filled === 0 && court.queue.length === 0}
          className="flex-1 py-3.5 rounded-2xl bg-gray-900 text-white font-extrabold text-[15px] active:scale-[0.98] transition-transform disabled:bg-gray-200 disabled:text-gray-400"
        >
          {court.queue.length > 0 ? t('Manage.endAndNext', { n: court.queue.length }) : t('Manage.endOnly')}
        </button>
      </div>
    </div>
  )
}
