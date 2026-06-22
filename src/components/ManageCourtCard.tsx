import type { CourtView, PlayerSlot } from '../api/client'

const PALETTE = [
  'bg-brand-pink', 'bg-brand-mint', 'bg-brand-yellow',
  'bg-brand-peach', 'bg-brand-lavender',
  'bg-purple-200', 'bg-blue-200', 'bg-teal-200',
]
function avatarColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

interface Props {
  court: CourtView
  onEnd: () => void
  onKick: (playerId: string) => void
}

function Chip({ slot, onKick }: { slot: PlayerSlot; onKick: () => void }) {
  return (
    <span className={`inline-flex items-center gap-1 pl-1 pr-2 py-1 rounded-full text-sm font-semibold text-white ${avatarColor(slot.player_id)}`}>
      <span className="w-5 h-5 rounded-full bg-white/30 flex items-center justify-center text-xs">
        {slot.display_name?.[0]?.toUpperCase()}
      </span>
      {slot.display_name}
      <button onClick={onKick} className="ml-0.5 text-white/80 hover:text-white font-bold">×</button>
    </span>
  )
}

export function ManageCourtCard({ court, onEnd, onKick }: Props) {
  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-extrabold text-gray-700">場地 {court.court_num}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
          court.status === 'playing' ? 'bg-brand-mint text-emerald-700' : 'bg-gray-100 text-gray-400'
        }`}>
          {court.status === 'playing' ? '進行中' : '空場'}
        </span>
      </div>

      {/* playing */}
      <div>
        <p className="text-xs text-gray-400 font-semibold mb-1">場上 ({court.playing.length}/4)</p>
        <div className="flex flex-wrap gap-2 min-h-[2rem]">
          {court.playing.length === 0 && <span className="text-sm text-gray-300">無</span>}
          {court.playing.map((p) => (
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
        disabled={court.playing.length === 0 && court.queue.length === 0}
        className="btn-primary w-full text-sm disabled:opacity-40"
      >
        {court.status === 'playing' ? '結束這場 → 換下一組' : '開始(排隊者上場)'}
      </button>
    </div>
  )
}
