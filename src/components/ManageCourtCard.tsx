import { useState } from 'react'
import type { CourtView, PlayerSlot } from '../api/client'
import { tierOf } from '../lib/levels'

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
  onKick: (playerId: string) => void
  onRename: (name: string) => void
  onRemove: () => void
}

function Chip({ slot, onKick }: { slot: PlayerSlot; onKick: () => void }) {
  const tier = tierOf(slot.level)
  const bg = tier ? tier.avatarBg : fallbackColor(slot.player_id)
  return (
    <span className={`inline-flex items-center gap-1 pl-1 pr-2 py-1 rounded-full text-sm font-semibold text-white ${bg}`}>
      <span className="w-5 h-5 rounded-full bg-white/30 flex items-center justify-center text-xs">
        {slot.level > 0 ? slot.level : slot.display_name?.[0]?.toUpperCase()}
      </span>
      {slot.display_name}
      <button onClick={onKick} className="ml-0.5 text-white/80 hover:text-white font-bold">×</button>
    </span>
  )
}

export function ManageCourtCard({ court, onEnd, onKick, onRename, onRemove }: Props) {
  const [editing, setEditing] = useState(false)
  const [nameInput, setNameInput] = useState(court.name ?? '')
  const title = court.name?.trim() ? court.name : `場地 ${court.court_num}`
  const playing = court.playing.filter((p) => p.player_id) // 去掉空位
  const filled = playing.length

  function saveName() {
    onRename(nameInput.trim())
    setEditing(false)
  }
  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        {editing ? (
          <div className="flex items-center gap-1 flex-1">
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder={`場地 ${court.court_num}`}
              autoFocus
              className="flex-1 border-2 border-gray-200 rounded-xl px-2 py-1 text-sm
                focus:outline-none focus:border-brand-pink"
            />
            <button onClick={saveName} className="text-xs font-bold text-brand-pink px-1">存</button>
          </div>
        ) : (
          <button
            onClick={() => { setNameInput(court.name ?? ''); setEditing(true) }}
            className="font-extrabold text-gray-700 flex items-center gap-1"
          >
            {title} <span className="text-gray-300 text-xs">✎</span>
          </button>
        )}
        {filled === 0 ? (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">空場</span>
        ) : filled === 4 ? (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand-mint text-emerald-700">
            進行中{elapsedMins(court.started_at) !== null ? ` · 已 ${elapsedMins(court.started_at)} 分` : ''}
          </span>
        ) : (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand-yellow text-amber-700">
            湊人中 {filled}/4
          </span>
        )}
      </div>

      {/* playing */}
      <div>
        <p className="text-xs text-gray-400 font-semibold mb-1">場上 ({filled}/4)</p>
        <div className="flex flex-wrap gap-2 min-h-[2rem]">
          {filled === 0 && <span className="text-sm text-gray-300">無</span>}
          {playing.map((p) => (
            <Chip key={p.player_id} slot={p} onKick={() => onKick(p.player_id)} />
          ))}
        </div>
      </div>

      {/* queue */}
      <div>
        <p className="text-xs text-gray-400 font-semibold mb-1">排隊 ({court.queue.length}/4)</p>
        <div className="flex flex-wrap gap-2 min-h-[2rem]">
          {court.queue.length === 0 && <span className="text-sm text-gray-300">無</span>}
          {court.queue.map((p) => (
            <Chip key={p.player_id} slot={p} onKick={() => onKick(p.player_id)} />
          ))}
        </div>
      </div>

      <button
        onClick={onEnd}
        disabled={filled === 0 && court.queue.length === 0}
        className="btn-primary w-full text-sm disabled:opacity-40"
      >
        {filled === 4 ? '結束這場 → 換下一組' : '結束這場'}
      </button>

      <button onClick={onRemove} className="w-full text-xs text-red-300 hover:text-red-400">
        刪除這個場地
      </button>
    </div>
  )
}
