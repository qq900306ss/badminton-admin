import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CourtView, PlayerSlot, SessionPlayer } from '../api/client'
import { useSessionView, useSessionPlayers, useSeatActions, useManageActions } from '../hooks/useApi'
import { useConfirm } from './Confirm'
import { tierOf } from '../lib/levels'
import { isPhotoUrl } from '../lib/avatar'
import { announceCourtEnd } from '../lib/announcer'

// the leader's on-site seating board for people without a phone.
// flow: tap an empty slot (circle) or 排隊 + → a name-list popup appears → pick a
// person → they go in. no scrolling to a bottom bench. rules match the player
// front-end (in-progress / full courts are locked — tap a playing person to 下場
// only while the court is still gathering).
// the board also carries 結束這場 per court + a 💰 結算 popup (mark 臨打費 paid),
// so the on-site tablet never needs to leave this screen.

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
      className={`w-full min-w-0 flex flex-col items-center gap-1 ${onClick ? 'active:scale-90 transition-transform' : ''}`}
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
      {/* 名字吃格寬 truncate(寫死 max-w 在窄格會把圓擠歪 —— 前台跑版同款問題) */}
      <span className="w-full px-0.5 text-center text-xs font-semibold truncate text-gray-700">{slot.display_name}</span>
    </button>
  )
}

function EmptySlot({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={onClick}
        className="w-11 h-11 rounded-full border-2 border-dashed border-brand-pink/60 text-brand-pink flex items-center justify-center
          text-xl font-bold bg-white/50 hover:bg-brand-pink hover:text-white active:scale-90 transition-all"
        aria-label={t('SeatingBoard.addToSlot')}
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
  onEnd: () => void
  onUndoEnd: () => void
  endBusy: boolean
  // 鎖定/解鎖(擋玩家端自助上場/排隊;排點板代排不受影響)
  onToggleLock: () => void
  lockBusy: boolean
}

function BoardCourt({ court, onEmptySlot, onQueueZone, onFilledPlayer, onQueuedPlayer, onEnd, onUndoEnd, endBusy, onToggleLock, lockBusy }: CourtProps) {
  const { t } = useTranslation()
  const slots = court.playing
  const filled = slots.filter((s) => s.player_id).length
  const full = filled === 4
  const mins = elapsedMins(court.started_at)
  const queueRoom = court.queue.length < 4

  return (
    <div className={`card !p-3 ${court.locked ? 'ring-2 ring-rose-200' : ''}`}>
      <div className="flex items-center justify-between mb-2 gap-1">
        <span className="font-extrabold text-gray-700 text-sm truncate">{court.name?.trim() ? court.name : t('SeatingBoard.courtN', { n: court.court_num })}</span>
        <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onToggleLock}
          disabled={lockBusy}
          aria-label={court.locked ? t('SeatingBoard.unlock') : t('SeatingBoard.lock')}
          title={court.locked ? t('SeatingBoard.unlock') : t('SeatingBoard.lock')}
          className={`text-[11px] font-bold px-2 py-0.5 rounded-full active:scale-90 transition-transform disabled:opacity-40 ${
            court.locked ? 'bg-rose-100 text-rose-600' : 'bg-gray-100 text-gray-400'
          }`}
        >
          {court.locked ? `🔒 ${t('SeatingBoard.lockedChip')}` : '🔓'}
        </button>
        {filled === 0 ? (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">{t('SeatingBoard.empty')}</span>
        ) : full ? (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-mint text-emerald-700">{t('SeatingBoard.inProgress')}{mins !== null ? t('SeatingBoard.mins', { mins }) : ''}</span>
        ) : (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-yellow text-amber-700">{t('SeatingBoard.gathering', { filled })}</span>
        )}
        </div>
      </div>

      {/* court */}
      <div className="relative rounded-2xl bg-gradient-to-b from-emerald-200/70 to-emerald-100/70 p-3 mb-2">
        <div className="absolute inset-3 rounded-lg border-2 border-white/80" />
        <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-white" />
        <div className="relative grid grid-cols-2 gap-y-3 py-2">
          {slots.map((slot, i) => (
            <div key={i} className="h-16 min-w-0 flex items-center justify-center">
              {slot.player_id ? (
                <Avatar slot={slot} locked={full} onClick={() => onFilledPlayer(slot.player_id, !full)} />
              ) : (
                <EmptySlot onClick={() => onEmptySlot(i)} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* queue — 固定 4 格(復刻前台 stable-grid 修法):有人=頭像、下一空位=可點的
          虛線圓、其餘=灰圓。高度恆定,有人排隊卡片不再忽然變高、頭像不跳位 */}
      <div className="rounded-xl p-2 bg-gray-50/60">
        <p className="text-[10px] text-gray-400 font-semibold mb-1">{t('SeatingBoard.queueLabel', { n: court.queue.length })}</p>
        <div className="grid grid-cols-4 gap-1">
          {Array.from({ length: 4 }, (_, i) => {
            const p = court.queue[i]
            return (
              <div key={i} className="h-16 min-w-0 flex items-center justify-center">
                {p ? (
                  <Avatar slot={p} onClick={() => onQueuedPlayer(p.player_id)} />
                ) : i === court.queue.length && queueRoom ? (
                  <div className="w-full min-w-0 flex flex-col items-center gap-1">
                    <button
                      onClick={onQueueZone}
                      aria-label={t('SeatingBoard.queueAdd')}
                      className="w-11 h-11 rounded-full border-2 border-dashed border-amber-400/70 text-amber-500 flex items-center justify-center
                        text-xl font-bold bg-white/50 hover:bg-amber-400 hover:text-white active:scale-90 transition-all"
                    >
                      +
                    </button>
                    <span className="text-xs">&nbsp;</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-11 h-11 rounded-full border-2 border-dashed border-gray-200 bg-white/30" />
                    <span className="text-xs">&nbsp;</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 結束這場(滿場=換下一組)+ 剛結束的 10 分鐘內可復原 — 跟管理頁同一套規則 */}
      <div className="mt-2 flex gap-2">
        <button
          onClick={onEnd}
          disabled={endBusy || (filled === 0 && court.queue.length === 0)}
          className="btn-primary flex-1 !py-2 text-xs disabled:opacity-40"
        >
          {full ? t('SeatingBoard.endRotate') : t('SeatingBoard.endGame')}
        </button>
        {court.can_undo && (
          <button
            onClick={onUndoEnd}
            disabled={endBusy}
            className="shrink-0 text-xs font-bold px-3 rounded-2xl bg-amber-100 text-amber-700 active:scale-95 transition-transform disabled:opacity-40"
          >
            ↩ {t('SeatingBoard.undoEnd')}
          </button>
        )}
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
  const { t } = useTranslation()
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
            placeholder={t('SeatingBoard.searchName')}
            className="mt-2 w-full border-2 border-gray-200 rounded-2xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
          />
        </div>
        <div className="overflow-y-auto p-3 space-y-1.5">
          {list.length === 0 ? (
            <p className="text-center text-sm text-gray-300 py-6">{t('SeatingBoard.noPeople')}</p>
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
                    <span className="text-[11px] text-gray-400 tabular-nums">{p.claimed ? t('SeatingBoard.games', { games: p.games }) : t('SeatingBoard.notArrived')}</span>
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

// 💰 結算彈窗:列出所有成員(沒繳的在前),點一下切換已收/未收臨打費,
// 順便看每人打了幾場 — 散場收錢就在排點板上完成,不用切回管理頁。
function SettleModal({ people, busy, onToggle, onClose }: {
  people: SessionPlayer[]
  busy: boolean
  onToggle: (playerId: string, paid: boolean) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const list = people
    .filter((p) => p.display_name.includes(q.trim()))
    .slice()
    .sort((a, b) => Number(a.paid) - Number(b.paid) || a.display_name.localeCompare(b.display_name))
  const paidCount = people.filter((p) => p.paid).length
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-gray-800">💰 {t('SeatingBoard.settleTitle')}</span>
            <button onClick={onClose} className="text-sm font-bold text-gray-400 px-1">✕</button>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {t('SeatingBoard.settleCollected', { paid: paidCount, total: people.length })} · {t('SeatingBoard.settleHint')}
          </p>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('SeatingBoard.searchName')}
            className="mt-2 w-full border-2 border-gray-200 rounded-2xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
          />
        </div>
        <div className="overflow-y-auto p-3 space-y-1.5">
          {list.length === 0 ? (
            <p className="text-center text-sm text-gray-300 py-6">{t('SeatingBoard.settleNoMatch')}</p>
          ) : (
            list.map((p) => (
              <button
                key={p.player_id}
                disabled={busy}
                onClick={() => onToggle(p.player_id, !p.paid)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-3 rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-60 ${
                  p.paid ? 'bg-amber-50' : 'bg-gray-50'
                }`}
              >
                <span className="min-w-0 flex items-center gap-1.5">
                  <span className="font-semibold text-gray-700 truncate">{p.display_name}</span>
                  <span className="shrink-0 text-[11px] text-gray-400 tabular-nums">{t('SeatingBoard.games', { games: p.games })}</span>
                </span>
                <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${
                  p.paid ? 'bg-amber-400 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {p.paid ? `💰 ${t('SeatingBoard.settlePaid')}` : t('SeatingBoard.settleUnpaid')}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export function SeatingBoard({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const { t } = useTranslation()
  const { data: session } = useSessionView(sessionId)
  const { data: players } = useSessionPlayers(sessionId)
  const { seatPlaying, seatQueue, unseatPlaying, unseatQueue } = useSeatActions(sessionId)
  const { endCourt, undoEnd, setPaid, lockCourt } = useManageActions(sessionId)
  const confirm = useConfirm()

  const [orient, setOrient] = useState<'landscape' | 'portrait'>('landscape')
  // a slot/queue waiting for a person to be picked from the popup.
  // position === null means the queue.
  const [picker, setPicker] = useState<{ courtId: string; position: number | null } | null>(null)
  const [settle, setSettle] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 2600)
    return () => clearTimeout(t)
  }, [msg])

  const onErr = (e: unknown) => {
    const m = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
    setMsg(m ?? t('SeatingBoard.actionFailed'))
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

  async function pick(playerId: string) {
    if (!picker || busy) return
    // 防呆:確認排誰上哪個場地/排隊,避免名單裡點錯人
    const player = (players ?? []).find((p) => p.player_id === playerId)?.display_name ?? ''
    const toPlaying = picker.position != null
    if (!(await confirm({
      message: t(toPlaying ? 'SeatingBoard.confirmSeat' : 'SeatingBoard.confirmQueue', { player, court: pickerCourtName }),
      confirmText: t(toPlaying ? 'SeatingBoard.confirmSeatBtn' : 'SeatingBoard.confirmQueueBtn'),
    }))) return
    if (toPlaying) {
      seatPlaying.mutate({ courtId: picker.courtId, playerId, position: picker.position! }, { onError: onErr })
    } else {
      seatQueue.mutate({ courtId: picker.courtId, playerId }, { onError: onErr })
    }
    setPicker(null)
  }
  function tapFilledPlayer(courtId: string, playerId: string, removable: boolean) {
    if (!removable) { setMsg(t('SeatingBoard.cannotSwapOut')); return }
    if (busy) return
    unseatPlaying.mutate({ courtId, playerId }, { onError: onErr })
  }
  function tapQueuedPlayer(courtId: string, playerId: string) {
    if (busy) return
    unseatQueue.mutate({ courtId, playerId }, { onError: onErr })
  }
  const endBusy = endCourt.isPending || undoEnd.isPending
  const courtLabel = (court: CourtView) =>
    court.name?.trim() ? court.name : t('SeatingBoard.courtN', { n: court.court_num })
  async function endGame(court: CourtView) {
    if (endBusy) return
    // 防呆:先確認再結束,避免誤觸把整組換下場
    if (!(await confirm({
      message: t('SeatingBoard.confirmEnd', { name: courtLabel(court) }),
      confirmText: t('SeatingBoard.confirmEndBtn'),
    }))) return
    // 按下當下 queue 就是下一組名單,先抓好;伺服器確認成功才播報(同管理頁)
    const snap = { name: court.name, court_num: court.court_num }
    const names = court.queue.map((p) => p.display_name)
    endCourt.mutate(court.court_id, {
      onSuccess: () => announceCourtEnd(court.court_id, snap, names),
      onError: onErr,
    })
  }
  async function undoEndGame(courtId: string) {
    if (!(await confirm({
      message: t('SeatingBoard.confirmUndo'),
      confirmText: t('SeatingBoard.confirmUndoBtn'),
    }))) return
    undoEnd.mutate(courtId, { onError: onErr })
  }

  const pickerCourt = picker ? courts.find((c) => c.court_id === picker.courtId) : null
  const pickerCourtName = pickerCourt ? (pickerCourt.name?.trim() ? pickerCourt.name : t('SeatingBoard.courtN', { n: pickerCourt.court_num })) : ''
  const pickerTitle = picker ? (picker.position != null ? t('SeatingBoard.seatOnCourt', { name: pickerCourtName }) : t('SeatingBoard.queueIntoCourt', { name: pickerCourtName })) : ''

  return (
    <div className="fixed inset-0 z-50 bg-brand-bg flex flex-col">
      {/* header — close is on the LEFT so a stray double-tap can't reach 結束開團 */}
      <div className="bg-white shadow-sm px-4 py-2.5 flex items-center gap-2 shrink-0">
        <button onClick={onClose} className="text-sm font-bold text-gray-500 bg-gray-100 rounded-full px-3 py-1.5 active:scale-95">✕ {t('SeatingBoard.close')}</button>
        <span className="font-extrabold text-gray-800 flex-1 text-center">🏸 {t('SeatingBoard.boardTitle')}</span>
        <button
          onClick={() => setSettle(true)}
          className="text-xs font-bold px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 active:scale-95"
        >
          💰 {t('SeatingBoard.settleBtn')}
        </button>
        <div className="flex rounded-full bg-gray-100 p-0.5 text-xs font-bold">
          <button onClick={() => setOrient('landscape')} className={`px-3 py-1 rounded-full ${orient === 'landscape' ? 'bg-brand-pink text-white' : 'text-gray-500'}`}>{t('SeatingBoard.landscape')}</button>
          <button onClick={() => setOrient('portrait')} className={`px-3 py-1 rounded-full ${orient === 'portrait' ? 'bg-brand-pink text-white' : 'text-gray-500'}`}>{t('SeatingBoard.portrait')}</button>
        </div>
      </div>

      {/* hint / error bar */}
      <div className="shrink-0 px-4 py-2 text-center">
        {msg ? (
          <span className="inline-block bg-red-100 text-red-500 text-sm font-bold rounded-full px-4 py-1">{msg}</span>
        ) : (
          <span className="text-sm font-semibold text-gray-400">{t('SeatingBoard.hint')}</span>
        )}
      </div>

      {/* courts fill the screen — picking happens in a popup, no bottom bench to scroll to */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {courts.length === 0 ? (
          <p className="text-center text-gray-300 mt-10">{t('SeatingBoard.noCourts')}</p>
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
                  onEnd={() => endGame(court)}
                  onUndoEnd={() => undoEndGame(court.court_id)}
                  endBusy={endBusy}
                  onToggleLock={() => lockCourt.mutate({ courtId: court.court_id, locked: !court.locked }, { onError: onErr })}
                  lockBusy={lockCourt.isPending}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {picker && (
        <PickerModal title={pickerTitle} people={offCourt} onPick={pick} onClose={() => setPicker(null)} />
      )}

      {settle && (
        <SettleModal
          people={(players ?? []).filter((p) => !p.pending)}
          busy={setPaid.isPending}
          onToggle={(playerId, paid) => setPaid.mutate({ playerId, paid })}
          onClose={() => setSettle(false)}
        />
      )}
    </div>
  )
}
