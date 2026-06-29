import { useEffect, useState } from 'react'
import type { CourtView, PlayerSlot, SessionPlayer } from '../api/client'
import { useSessionView, useSessionPlayers, useSeatActions } from '../hooks/useApi'
import { tierOf } from '../lib/levels'
import { isPhotoUrl } from '../lib/avatar'

// the leader's on-site seating board for people without a phone.
// flow: tap an empty slot (circle) or 排隊 + → a name-list popup appears → pick a
// person → they go in. no scrolling to a bottom bench. rules match the player
// front-end (in-progress / full courts are locked — tap a playing person to 下場
// only while the court is still gathering).

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

function Avatar({ slot, onClick, locked }: { slot: PlayerSlot; onClick?: () => void; locked?: boolean }) {
  // [...str][0] is emoji-safe (str[0] breaks surrogate pairs → 亂碼)
  const initial = [...(slot.display_name ?? '')][0]?.toUpperCase() ?? '?'
  const tier = tierOf(slot.level)
  const bg = tier ? tier.avatarBg : fallbackColor(slot.player_id)
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`flex flex-col items-center gap-1 ${onClick ? 'active:scale-90 transition-transform' : ''}`}
    >
      <div className="relative">
        {isPhotoUrl(slot.avatar_url) ? (
          <img src={slot.avatar_url} alt={slot.display_name}
            className="w-11 h-11 rounded-full object-cover shadow-md ring-2 ring-white" />
        ) : (
          <div className={`w-11 h-11 rounded-full ${bg} flex items-center justify-center shadow-md ring-2 ring-white`}>
            {slot.avatar_url
              ? <span className="text-xl">{slot.avatar_url}</span>
              : <span className="text-base font-extrabold text-white">{initial}</span>}
          </div>
        )}
        {slot.level > 0 && (
          <span className={`absolute -top-1 -right-1 ${tier ? tier.avatarBg : 'bg-gray-400'} text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow border-2 border-white`}>
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

function EmptySlot({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={onClick}
        className="w-11 h-11 rounded-full border-2 border-dashed border-brand-pink/60 text-brand-pink flex items-center justify-center
          text-xl font-bold bg-white/50 hover:bg-brand-pink hover:text-white active:scale-90 transition-all"
        aria-label="加人到這個位置"
      >
        +
      </button>
      <span className="text-xs">&nbsp;</span>
    </div>
  )
}

interface CourtProps {
  court: CourtView
  onEmptySlot: (position: number) => void
  onQueueZone: () => void
  onFilledPlayer: (playerId: string, removable: boolean) => void
  onQueuedPlayer: (playerId: string) => void
}

function BoardCourt({ court, onEmptySlot, onQueueZone, onFilledPlayer, onQueuedPlayer }: CourtProps) {
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
                <Avatar slot={slot} locked={full} onClick={() => onFilledPlayer(slot.player_id, !full)} />
              ) : (
                <EmptySlot onClick={() => onEmptySlot(i)} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* queue */}
      <div className="rounded-xl p-2 bg-gray-50/60">
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
          {court.queue.length === 0 && <span className="text-[11px] text-gray-300">點「排隊 +」加人</span>}
        </div>
      </div>
    </div>
  )
}

// the name-list popup that opens when you tap a slot / 排隊 — pick a person to seat.
function PickerModal({ title, people, onPick, onClose }: {
  title: string
  people: SessionPlayer[]
  onPick: (playerId: string) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const list = people.filter((p) => p.display_name.includes(q.trim()))
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-gray-800">{title}</span>
            <button onClick={onClose} className="text-sm font-bold text-gray-400 px-1">✕</button>
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
            placeholder="🔍 搜尋名字"
            className="mt-2 w-full border-2 border-gray-200 rounded-2xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
          />
        </div>
        <div className="overflow-y-auto p-3 space-y-1.5">
          {list.length === 0 ? (
            <p className="text-center text-sm text-gray-300 py-6">沒有可加入的人</p>
          ) : (
            list.map((p) => {
              const tier = tierOf(p.level)
              return (
                <button
                  key={p.player_id}
                  onClick={() => onPick(p.player_id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-3 rounded-2xl bg-gray-50 active:scale-[0.98] transition-transform ${p.claimed ? '' : 'opacity-60'}`}
                >
                  <span className="font-semibold text-gray-700 truncate">{p.display_name}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    {p.level > 0 && tier && <span className={`text-[10px] px-2 py-0.5 rounded-full ${tier.chip}`}>{tier.name} {p.level}</span>}
                    <span className="text-[11px] text-gray-400 tabular-nums">{p.claimed ? `${p.games} 場` : '未到'}</span>
                  </span>
                </button>
              )
            })
          )}
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
  // a slot/queue waiting for a person to be picked from the popup.
  // position === null means the queue.
  const [picker, setPicker] = useState<{ courtId: string; position: number | null } | null>(null)
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
  // off-court people, fair-sorted (已到 first, then fewest games) — the popup list
  const offCourt = (players ?? [])
    .filter((p) => !onCourt.has(p.player_id))
    .filter((p) => !p.pending) // 待核准的家人先不出現在排點板
    .slice()
    .sort((a, b) => Number(b.claimed) - Number(a.claimed) || a.games - b.games || a.display_name.localeCompare(b.display_name))

  // ignore taps while a seat/unseat is in flight → no duplicate mutations
  const busy =
    seatPlaying.isPending || seatQueue.isPending || unseatPlaying.isPending || unseatQueue.isPending

  function pick(playerId: string) {
    if (!picker || busy) return
    if (picker.position != null) {
      seatPlaying.mutate({ courtId: picker.courtId, playerId, position: picker.position }, { onError: onErr })
    } else {
      seatQueue.mutate({ courtId: picker.courtId, playerId }, { onError: onErr })
    }
    setPicker(null)
  }
  function tapFilledPlayer(courtId: string, playerId: string, removable: boolean) {
    if (!removable) { setMsg('進行中(滿 4 人),不能換下 — 請按「結束換場」'); return }
    if (busy) return
    unseatPlaying.mutate({ courtId, playerId }, { onError: onErr })
  }
  function tapQueuedPlayer(courtId: string, playerId: string) {
    if (busy) return
    unseatQueue.mutate({ courtId, playerId }, { onError: onErr })
  }

  const pickerCourt = picker ? courts.find((c) => c.court_id === picker.courtId) : null
  const pickerCourtName = pickerCourt ? (pickerCourt.name?.trim() ? pickerCourt.name : `場地 ${pickerCourt.court_num}`) : ''
  const pickerTitle = picker ? (picker.position != null ? `選人上「${pickerCourtName}」` : `排進「${pickerCourtName}」排隊`) : ''

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
          <span className="text-sm font-semibold text-gray-400">點空位 ＋ 或「排隊 +」挑人加入 · 點場上的人可換下</span>
        )}
      </div>

      {/* courts fill the screen — picking happens in a popup, no bottom bench to scroll to */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {courts.length === 0 ? (
          <p className="text-center text-gray-300 mt-10">這場還沒有球場</p>
        ) : (
          <div
            className="grid gap-3"
            style={{
              // landscape: as many comfortably-sized (≥240px) courts per row as
              // fit, then WRAP to the next row. portrait: a tidy 2 columns.
              gridTemplateColumns:
                orient === 'landscape'
                  ? 'repeat(auto-fill, minmax(240px, 1fr))'
                  : 'repeat(2, minmax(0, 1fr))',
            }}
          >
            {courts.map((court) => (
              <div key={court.court_id} className="min-w-0">
                <BoardCourt
                  court={court}
                  onEmptySlot={(pos) => setPicker({ courtId: court.court_id, position: pos })}
                  onQueueZone={() => setPicker({ courtId: court.court_id, position: null })}
                  onFilledPlayer={(pid, removable) => tapFilledPlayer(court.court_id, pid, removable)}
                  onQueuedPlayer={(pid) => tapQueuedPlayer(court.court_id, pid)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {picker && (
        <PickerModal title={pickerTitle} people={offCourt} onPick={pick} onClose={() => setPicker(null)} />
      )}
    </div>
  )
}
