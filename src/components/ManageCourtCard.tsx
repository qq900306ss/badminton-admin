import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { CourtView, PlayerSlot } from '../api/client'
import { tierOf } from '../lib/levels'
import { isPhotoUrl } from '../lib/avatar'

const PALETTE = [
  'bg-brand-pink', 'bg-brand-mint', 'bg-brand-yellow',
  'bg-brand-peach', 'bg-brand-lavender',
  'bg-purple-200', 'bg-blue-200', 'bg-teal-200',
]
function fallbackColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

function elapsedMins(startedAt?: string): number | null {
  if (!startedAt) return null
  const ms = Date.now() - new Date(startedAt).getTime()
  return ms < 0 ? null : Math.floor(ms / 60000)
}

interface Props {
  court: CourtView
  onEnd: () => void
  onUndoEnd: () => void
  onKick: (playerId: string) => void
  onRename: (name: string) => void
  onRemove: () => void
  // 鎖定/解鎖這個場地(團主):鎖定後玩家端不能自助上場/排隊,團主仍可手動排
  onToggleLock: () => void
  // 跟別的場地交換排隊的人 — 只在「這裡有人排隊且別場也有人排隊」時由頁面傳入
  onSwapQueue?: () => void
}

function Chip({ slot, onKick }: { slot: PlayerSlot; onKick: () => void }) {
  const tier = tierOf(slot.level)
  const bg = tier ? tier.avatarBg : fallbackColor(slot.player_id)
  return (
    <span className={`inline-flex items-center gap-1 pl-1 pr-2 py-1 rounded-full text-sm font-semibold text-white ${bg}`}>
      <span className="w-5 h-5 rounded-full bg-white/30 flex items-center justify-center text-xs overflow-hidden">
        {isPhotoUrl(slot.avatar_url) ? (
          <img src={slot.avatar_url} alt="" className="w-full h-full object-cover" />
        ) : slot.avatar_url ? (
          slot.avatar_url
        ) : slot.level > 0 ? (
          slot.level
        ) : (
          [...(slot.display_name ?? '')][0]?.toUpperCase()
        )}
      </span>
      {slot.display_name}
      <button onClick={onKick} className="ml-0.5 text-white/80 hover:text-white font-bold">×</button>
    </span>
  )
}

export function ManageCourtCard({ court, onEnd, onUndoEnd, onKick, onRename, onRemove, onToggleLock, onSwapQueue }: Props) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [nameInput, setNameInput] = useState(court.name ?? '')
  // keep the field in sync with live data when not actively editing (a WS rename
  // from elsewhere shouldn't be silently overwritten by a stale input)
  useEffect(() => {
    if (!editing) setNameInput(court.name ?? '')
  }, [court.name, editing])
  const title = court.name?.trim() ? court.name : t('ManageCourtCard.courtN', { n: court.court_num })
  const playing = court.playing.filter((p) => p.player_id) // 去掉空位
  const filled = playing.length

  function saveName() {
    onRename(nameInput.trim())
    setEditing(false)
  }
  return (
    <div className={`card space-y-3 ${court.locked ? 'ring-2 ring-rose-200' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        {editing ? (
          <div className="flex items-center gap-1 flex-1">
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder={t('ManageCourtCard.courtN', { n: court.court_num })}
              autoFocus
              className="flex-1 border-2 border-gray-200 rounded-xl px-2 py-1 text-sm
                focus:outline-none focus:border-brand-pink"
            />
            <button onClick={saveName} className="text-xs font-bold text-brand-pink px-1">{t('ManageCourtCard.save')}</button>
          </div>
        ) : (
          <button
            onClick={() => { setNameInput(court.name ?? ''); setEditing(true) }}
            className="font-extrabold text-gray-700 flex items-center gap-1"
          >
            {title} <span className="text-gray-300 text-xs">✎</span>
          </button>
        )}
        <div className="flex items-center gap-1.5">
          {court.locked && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-600">🔒 {t('ManageCourtCard.locked')}</span>
          )}
          {filled === 0 ? (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">{t('ManageCourtCard.empty')}</span>
          ) : filled === 4 ? (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand-mint text-emerald-700">
              {t('ManageCourtCard.inProgress')}{elapsedMins(court.started_at) !== null ? t('ManageCourtCard.minsElapsed', { mins: elapsedMins(court.started_at) }) : ''}
            </span>
          ) : (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand-yellow text-amber-700">
              {t('ManageCourtCard.gathering', { filled })}
            </span>
          )}
        </div>
      </div>

      {/* playing */}
      <div>
        <p className="text-xs text-gray-400 font-semibold mb-1">{t('ManageCourtCard.playing', { filled })}</p>
        <div className="flex flex-wrap gap-2 min-h-[2rem]">
          {filled === 0 && <span className="text-sm text-gray-300">{t('ManageCourtCard.none')}</span>}
          {playing.map((p) => (
            <Chip key={p.player_id} slot={p} onKick={() => onKick(p.player_id)} />
          ))}
        </div>
      </div>

      {/* queue */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-gray-400 font-semibold">{t('ManageCourtCard.queue', { n: court.queue.length })}</p>
          {onSwapQueue && (
            <button
              onClick={onSwapQueue}
              className="text-[11px] font-bold text-brand-pink bg-brand-pink/10 rounded-full px-2 py-0.5 active:scale-95 transition-transform"
            >
              ⇄ {t('ManageCourtCard.swapWithOther')}
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 min-h-[2rem]">
          {court.queue.length === 0 && <span className="text-sm text-gray-300">{t('ManageCourtCard.none')}</span>}
          {court.queue.map((p) => (
            <Chip key={p.player_id} slot={p} onKick={() => onKick(p.player_id)} />
          ))}
        </div>
      </div>

      {/* 結束(這場)與還原(剛剛那次)並存 — 還原只是多一個救回誤按的選項,
          不該擋住團主結束目前這場 */}
      <div className="space-y-2">
        <button
          onClick={onEnd}
          disabled={filled === 0 && court.queue.length === 0}
          className="btn-primary w-full text-sm disabled:opacity-40"
        >
          {filled === 4 ? t('ManageCourtCard.endRotate') : t('ManageCourtCard.endGame')}
        </button>
        {court.can_undo && (
          <button
            onClick={onUndoEnd}
            className="w-full text-sm font-bold py-2.5 rounded-2xl bg-amber-100 text-amber-700 active:scale-95 transition-transform"
          >
            ↩ {t('ManageCourtCard.undoEnd')}
          </button>
        )}
      </div>

      <button
        onClick={onToggleLock}
        className={`w-full text-sm font-bold py-2.5 rounded-2xl active:scale-95 transition-transform ${
          court.locked ? 'bg-rose-100 text-rose-600' : 'bg-gray-100 text-gray-500'
        }`}
      >
        {court.locked ? `🔓 ${t('ManageCourtCard.unlock')}` : `🔒 ${t('ManageCourtCard.lock')}`}
      </button>

      <button onClick={onRemove} className="w-full text-xs text-red-300 hover:text-red-400">
        {t('ManageCourtCard.removeCourt')}
      </button>
    </div>
  )
}
