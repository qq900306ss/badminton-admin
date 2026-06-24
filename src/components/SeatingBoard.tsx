import { useEffect, useState } from 'react'
import type { CourtView, PlayerSlot, SessionPlayer } from '../api/client'
import { useSessionView, useSessionPlayers, useSeatActions } from '../hooks/useApi'
import { tierOf } from '../lib/levels'

// the leader's on-site seating board: seat people who have no phone, by tapping.
// works in BOTH orders — tap a person then a slot, or a slot then a person.
// rules are identical to the player front-end (in-progress courts are locked).

type Pending =
  | { kind: 'player'; playerId: string; name: string }
  | { kind: 'slot'; courtId: string; position: number }
  | { kind: 'queue'; courtId: string }
  | null

const PALETTE = ['bg-brand-pink', 'bg-brand-mint', 'bg-brand-yellow', 'bg-brand-peach', 'bg-brand-lavender', 'bg-purple-200', 'bg-blue-200', 'bg-teal-200']
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

function Avatar({ slot, onClick, locked, dim }: { slot: PlayerSlot; onClick?: () => void; locked?: boolean; dim?: boolean }) {
  const initial = slot.display_name?.[0]?.toUpperCase() ?? '?'
  const tier = tierOf(slot.level)
  const bg = tier ? tier.avatarBg : fallbackColor(slot.player_id)
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`flex flex-col items-center gap-1 ${onClick ? 'active:scale-90 transition-transform' : ''} ${dim ? 'opacity-90' : ''}`}
    >
      <div className="relative">
        <div className={`w-11 h-11 rounded-full ${bg} flex items-center justify-center text-base font-extrabold text-white shadow-md ring-2 ring-white`}>
          {initial}
        </div>
        {slot.level > 0 && (
          <span className="absolute -top-1 -right-1 bg-white text-gray-700 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow border border-gray-100">
            {slot.level}
          </span>
        )}
        {locked && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-gray-500 text-white text-[9px] rounded-full px-1 leading-4 shadow">🔒</span>
        )}
      </div>
      <span className="text-xs font-semibold max-w-[4.5rem] truncate text-gray-700">{slot.display_name}</span>
    </button>
  )
}

function EmptySlot({ armed, highlight, onClick }: { armed: boolean; highlight: boolean; onClick: () => void }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={onClick}
        className={`w-11 h-11 rounded-full border-2 border-dashed flex items-center justify-center text-xl font-bold transition-all active:scale-90
          ${highlight ? 'border-brand-pink bg-brand-pink text-white ring-4 ring-brand-pink/40'
            : armed ? 'border-brand-pink text-brand-pink bg-white animate-pulse'
              : 'border-gray-300 text-gray-300 bg-white/40'}`}
        aria-label="放這個位置"
      >
        +
      </button>
      <span className="text-xs">&nbsp;</span>
    </div>
  )
}

interface CourtProps {
  court: CourtView
  armed: boolean
  pendingSlot: number | null // position highlighted on THIS court
  pendingQueue: boolean // queue zone highlighted on THIS court
  onEmptySlot: (position: number) => void
  onQueueZone: () => void
  onFilledPlayer: (playerId: string, removable: boolean) => void
  onQueuedPlayer: (playerId: string) => void
}

function BoardCourt({ court, armed, pendingSlot, pendingQueue, onEmptySlot, onQueueZone, onFilledPlayer, onQueuedPlayer }: CourtProps) {
  const slots = court.playing
  const filled = slots.filter((s) => s.player_id).length
  const full = filled === 4
  const mins = elapsedMins(court.started_at)
  const queueRoom = court.queue.length < 4

  return (
    <div className="card !p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-extrabold text-gray-700 text-sm">{court.name?.trim() ? court.name : `場地 ${court.court_num}`}</span>
        {filled === 0 ? (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">空場</span>
        ) : full ? (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-mint text-emerald-700">進行中{mins !== null ? ` · ${mins} 分` : ''}</span>
        ) : (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-yellow text-amber-700">湊人中 {filled}/4</span>
        )}
      </div>

      {/* court */}
      <div className="relative rounded-2xl bg-gradient-to-b from-emerald-200/70 to-emerald-100/70 p-3 mb-2">
        <div className="absolute inset-3 rounded-lg border-2 border-white/80" />
        <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-white" />
        <div className="relative grid grid-cols-2 gap-y-3 py-2">
          {slots.map((slot, i) => (
            <div key={i} className="h-16 flex items-center justify-center">
              {slot.player_id ? (
                <Avatar
                  slot={slot}
                  locked={full}
                  onClick={() => onFilledPlayer(slot.player_id, !full)}
                />
              ) : (
                <EmptySlot armed={armed} highlight={pendingSlot === i} onClick={() => onEmptySlot(i)} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* queue */}
      <div className={`rounded-xl p-2 ${pendingQueue ? 'ring-2 ring-brand-pink bg-brand-pink/10' : armed && queueRoom ? 'bg-amber-50' : ''}`}>
        <div className="flex items-center gap-2 flex-wrap min-h-[1.5rem]">
          <button
            onClick={onQueueZone}
            disabled={!queueRoom}
            className="text-[11px] font-bold px-2 py-1 rounded-full bg-brand-yellow text-amber-700 disabled:opacity-30 active:scale-90 transition-transform"
          >
            排隊 +
          </button>
          {court.queue.map((p) => (
            <Avatar key={p.player_id} slot={p} onClick={() => onQueuedPlayer(p.player_id)} />
          ))}
          {court.queue.length === 0 && <span className="text-[11px] text-gray-300">點「排隊 +」再點人</span>}
        </div>
      </div>
    </div>
  )
}

export function SeatingBoard({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const { data: session } = useSessionView(sessionId)
  const { data: players } = useSessionPlayers(sessionId)
  const { seatPlaying, seatQueue, unseatPlaying, unseatQueue } = useSeatActions(sessionId)

  const [orient, setOrient] = useState<'landscape' | 'portrait'>('landscape')
  const [pending, setPending] = useState<Pending>(null)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 2600)
    return () => clearTimeout(t)
  }, [msg])

  const onErr = (e: unknown) => {
    const m = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
    setMsg(m ?? '操作失敗')
  }

  const courts = session?.courts ?? []
  const onCourt = new Set(
    courts.flatMap((c) => [...c.playing.map((s) => s.player_id), ...c.queue.map((s) => s.player_id)]).filter(Boolean)
  )
  const bench = (players ?? [])
    .filter((p) => !onCourt.has(p.player_id))
    .slice()
    .sort((a, b) => Number(b.claimed) - Number(a.claimed) || a.games - b.games || a.display_name.localeCompare(b.display_name))

  // place the pending player into a target, or arm a target waiting for a player
  function place(playerId: string, target: { kind: 'slot'; courtId: string; position: number } | { kind: 'queue'; courtId: string }) {
    if (target.kind === 'slot') {
      seatPlaying.mutate({ courtId: target.courtId, playerId, position: target.position }, { onError: onErr })
    } else {
      seatQueue.mutate({ courtId: target.courtId, playerId }, { onError: onErr })
    }
    setPending(null)
  }

  function tapPlayer(p: SessionPlayer) {
    if (pending?.kind === 'slot') return place(p.player_id, pending)
    if (pending?.kind === 'queue') return place(p.player_id, pending)
    if (pending?.kind === 'player' && pending.playerId === p.player_id) return setPending(null)
    setPending({ kind: 'player', playerId: p.player_id, name: p.display_name })
  }
  function tapEmptySlot(courtId: string, position: number) {
    if (pending?.kind === 'player') return place(pending.playerId, { kind: 'slot', courtId, position })
    setPending((cur) => (cur?.kind === 'slot' && cur.courtId === courtId && cur.position === position ? null : { kind: 'slot', courtId, position }))
  }
  function tapQueueZone(courtId: string) {
    if (pending?.kind === 'player') return place(pending.playerId, { kind: 'queue', courtId })
    setPending((cur) => (cur?.kind === 'queue' && cur.courtId === courtId ? null : { kind: 'queue', courtId }))
  }
  function tapFilledPlayer(courtId: string, playerId: string, removable: boolean) {
    if (!removable) { setMsg('進行中(滿 4 人),不能換下 — 請按「結束換場」'); return }
    unseatPlaying.mutate({ courtId, playerId }, { onError: onErr })
    setPending(null)
  }
  function tapQueuedPlayer(courtId: string, playerId: string) {
    unseatQueue.mutate({ courtId, playerId }, { onError: onErr })
    setPending(null)
  }

  const hint =
    pending?.kind === 'player' ? `已選「${pending.name}」→ 點球場空位上場,或點「排隊 +」`
      : pending?.kind === 'slot' ? '已選一個空位 → 點下方一個人放上去'
        : pending?.kind === 'queue' ? '已選排隊 → 點下方一個人'
          : '點一個人、再點球場位置(或反過來)就能排點'
  const armed = pending?.kind === 'player'

  return (
    <div className="fixed inset-0 z-50 bg-brand-bg flex flex-col">
      {/* header — close is on the LEFT so a stray double-tap can't reach 結束開團 */}
      <div className="bg-white shadow-sm px-4 py-2.5 flex items-center gap-2 shrink-0">
        <button onClick={onClose} className="text-sm font-bold text-gray-500 bg-gray-100 rounded-full px-3 py-1.5 active:scale-95">✕ 關閉</button>
        <span className="font-extrabold text-gray-800 flex-1 text-center">🏸 現場排點板</span>
        <div className="flex rounded-full bg-gray-100 p-0.5 text-xs font-bold">
          <button onClick={() => setOrient('landscape')} className={`px-3 py-1 rounded-full ${orient === 'landscape' ? 'bg-brand-pink text-white' : 'text-gray-500'}`}>橫向</button>
          <button onClick={() => setOrient('portrait')} className={`px-3 py-1 rounded-full ${orient === 'portrait' ? 'bg-brand-pink text-white' : 'text-gray-500'}`}>直版</button>
        </div>
      </div>

      {/* hint / error bar */}
      <div className="shrink-0 px-4 py-2 text-center">
        {msg ? (
          <span className="inline-block bg-red-100 text-red-500 text-sm font-bold rounded-full px-4 py-1">{msg}</span>
        ) : (
          <span className={`text-sm font-semibold ${armed ? 'text-brand-pink' : 'text-gray-400'}`}>{hint}</span>
        )}
      </div>

      {/* body: courts + bench flow together so there's no big middle gap.
          landscape → all courts share one row (equal width, no horizontal scroll). */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {courts.length === 0 ? (
          <p className="text-center text-gray-300 mt-10">這場還沒有球場</p>
        ) : (
          <div className={orient === 'landscape' ? 'flex flex-wrap gap-3 items-start' : 'grid grid-cols-1 sm:grid-cols-2 gap-3'}>
            {courts.map((court) => (
              <div key={court.court_id} className={orient === 'landscape' ? 'flex-1 basis-0 min-w-0' : ''}>
                <BoardCourt
                  court={court}
                  armed={armed}
                  pendingSlot={pending?.kind === 'slot' && pending.courtId === court.court_id ? pending.position : null}
                  pendingQueue={pending?.kind === 'queue' && pending.courtId === court.court_id}
                  onEmptySlot={(pos) => tapEmptySlot(court.court_id, pos)}
                  onQueueZone={() => tapQueueZone(court.court_id)}
                  onFilledPlayer={(pid, removable) => tapFilledPlayer(court.court_id, pid, removable)}
                  onQueuedPlayer={(pid) => tapQueuedPlayer(court.court_id, pid)}
                />
              </div>
            ))}
          </div>
        )}

        {/* bench — players not on any court, hugging the courts above */}
        <div className="mt-3 bg-white rounded-2xl border border-gray-100 px-4 py-3">
          <p className="text-xs font-bold text-gray-500 mb-2">
            未在場上的人 <span className="text-gray-300">({bench.length})</span>
          </p>
          {bench.length === 0 ? (
            <p className="text-sm text-gray-300">所有人都在場上或排隊中</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {bench.map((p) => {
                const tier = tierOf(p.level)
                const sel = pending?.kind === 'player' && pending.playerId === p.player_id
                return (
                  <button
                    key={p.player_id}
                    onClick={() => tapPlayer(p)}
                    className={`px-3 py-2 rounded-2xl text-sm font-semibold flex items-center gap-1.5 transition-all active:scale-95
                      ${sel ? 'bg-brand-pink text-white ring-4 ring-brand-pink/30 scale-105' : tier ? tier.chip : 'bg-gray-100 text-gray-600'}
                      ${p.claimed ? '' : 'opacity-60'}`}
                  >
                    {p.display_name}
                    <span className={`text-[10px] rounded-full px-1.5 ${sel ? 'bg-white/30' : 'bg-white/70 text-gray-600'}`}>
                      {p.level > 0 ? `Lv${p.level}` : '?'}
                    </span>
                    {!p.claimed && <span className="text-[10px]">未到</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
