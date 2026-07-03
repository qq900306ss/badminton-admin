import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { sessionApi } from '../api/client'
import type { SessionPlayer } from '../api/client'
import { useSessionView, useSessionPlayers, useManageActions } from '../hooks/useApi'
import { ManageCourtCard } from '../components/ManageCourtCard'
import { StatsPanel } from '../components/StatsPanel'
import { ActionLogPanel } from '../components/ActionLogPanel'
import { SessionSummary } from '../components/SessionSummary'
import { PasswordCard } from '../components/PasswordCard'
import { TimesCard } from '../components/TimesCard'
import { LocationCard } from '../components/LocationCard'
import { ContactCard } from '../components/ContactCard'
import { FairPlayCard } from '../components/FairPlayCard'
import { SeatingBoard } from '../components/SeatingBoard'
import { SwapQueueModal } from '../components/SwapQueueModal'
import { SignupSettingsCard } from '../components/SignupSettingsCard'
import { SignupReviewPanel } from '../components/SignupReviewPanel'
import { useConfirm } from '../components/Confirm'
import { CourtSkeleton } from '../components/Skeleton'
import { TIERS, tierOf } from '../lib/levels'
import { isPhotoUrl } from '../lib/avatar'
import { connectSessionWS } from '../lib/realtime'

const BOOKING_URL = import.meta.env.VITE_BOOKING_URL || 'http://localhost:5174'

// small avatar for the people list, so same-named players are still distinguishable
function MiniAvatar({ slot }: { slot: SessionPlayer }) {
  const tier = tierOf(slot.level)
  const bg = tier ? tier.avatarBg : 'bg-gray-300'
  if (isPhotoUrl(slot.avatar_url))
    return <img src={slot.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
  return (
    <span className={`w-5 h-5 rounded-full ${bg} shrink-0 flex items-center justify-center text-[11px] leading-none text-white`}>
      {slot.avatar_url ? slot.avatar_url : [...(slot.display_name ?? '')][0]?.toUpperCase()}
    </span>
  )
}

// among players sharing a display_name, give each a stable 1-based ordinal so the
// leader can tell "蔡川海 #1" from "蔡川海 #2". Returns {} when no name collides.
function dupOrdinals(players: SessionPlayer[]): Record<string, number> {
  const count: Record<string, number> = {}
  for (const p of players) count[p.display_name] = (count[p.display_name] ?? 0) + 1
  const seen: Record<string, number> = {}
  const out: Record<string, number> = {}
  for (const p of [...players].sort((a, b) => a.player_id.localeCompare(b.player_id))) {
    if (count[p.display_name] > 1) {
      seen[p.display_name] = (seen[p.display_name] ?? 0) + 1
      out[p.player_id] = seen[p.display_name]
    }
  }
  return out
}

export function SessionManagePage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const nav = useNavigate()
  const sid = sessionId ?? ''

  const { data: session, isLoading } = useSessionView(sid)
  const { data: players } = useSessionPlayers(sid)
  const { endCourt, undoEnd, kick, addPlaying, addCourt, addPlayer, setLevel, setPlayerName, setPaid, approveFamily, renameCourt, removeCourt, addQueue, swapQueue, removePlayer } = useManageActions(sid)
  const confirm = useConfirm()
  const qc = useQueryClient()

  // 報名中(等核准)的人只出現在報名審核區,不算成員
  const roster = (players ?? []).filter((p) => !(p.pending && p.is_signup))

  // real-time: WebSocket nudge → refetch the moment ANYTHING changes (courts,
  // players, seating, stats, action log). The server broadcasts after every
  // write — including this leader's own — so actions reflect instantly without
  // polling.
  useEffect(() => {
    if (!sid) return
    return connectSessionWS(sid, (m) => {
      const inval = (k: string) => qc.invalidateQueries({ queryKey: [k, sid] })
      const scope = m.scope ?? 'all'
      // refetch only what actually changed (server tells us via scope)
      if (scope === 'court' || scope === 'session') {
        inval('session')
      } else if (scope === 'player') {
        inval('session') // names/levels also render on court
        inval('session-players')
      } else if (scope === 'game') {
        inval('session')
        inval('session-players') // stats changed
        inval('games')
      } else {
        inval('session')
        inval('session-players')
        inval('games')
      }
      inval('action-logs') // cheap: query is disabled unless the log panel is open
    })
  }, [sid, qc])

  const [showQR, setShowQR] = useState(true)
  const [poster, setPoster] = useState(false)
  const [summary, setSummary] = useState(false)
  const [addTarget, setAddTarget] = useState<string | null>(null) // court_id to add a player to
  const [swapSource, setSwapSource] = useState<string | null>(null) // court_id 發起排隊交換的場地
  const [newName, setNewName] = useState('')
  const [levelTarget, setLevelTarget] = useState<string | null>(null) // player_id being re-leveled
  const [renameInput, setRenameInput] = useState('') // 團主改該玩家本場名稱
  const [memberFilter, setMemberFilter] = useState('')
  const [onlyUnclaimed, setOnlyUnclaimed] = useState(false)
  const [onlyUnpaid, setOnlyUnpaid] = useState(false)
  const [addFilter, setAddFilter] = useState('')
  const [board, setBoard] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editTitle, setEditTitle] = useState(false)
  const [titleInput, setTitleInput] = useState('')
  const [savingTitle, setSavingTitle] = useState(false)

  async function saveTitle() {
    const t = titleInput.trim()
    if (!t) return
    setSavingTitle(true)
    try {
      await sessionApi.setTitle(sid, t)
      qc.invalidateQueries({ queryKey: ['session', sid] })
      setEditTitle(false)
    } catch {
      /* keep editing on failure */
    } finally {
      setSavingTitle(false)
    }
  }

  const joinUrl = `${BOOKING_URL}/?s=${sid}`

  async function closeSession() {
    if (!(await confirm({ message: '確定要結束這次開團嗎?', confirmText: '結束開團', danger: true }))) return
    await sessionApi.close(sid)
    setSummary(true) // 結束後直接看散場總結
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-brand-bg p-4">
        <CourtSkeleton />
      </div>
    )
  }

  const dup = dupOrdinals(players ?? [])
  const targetPlayer = (players ?? []).find((p) => p.player_id === levelTarget)
  // owner_id → display name, so family members can show "(○○ 的家人)"
  const nameById = new Map((players ?? []).map((p) => [p.player_id, p.display_name]))
  const ownerLabel = (p: SessionPlayer) =>
    p.owner_id ? `${nameById.get(p.owner_id) ?? '某人'} 的家人` : ''

  return (
    <div className="min-h-screen bg-brand-bg pb-10">
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <button onClick={() => nav('/')} className="text-sm text-gray-400">← 返回</button>
        <span className="font-extrabold text-gray-800">場中管理</span>
        <div className="flex items-center gap-3">
          <button onClick={() => setSummary(true)} className="text-sm font-semibold text-brand-pink">總結</button>
          <button onClick={closeSession} className="text-sm font-semibold text-red-400">結束開團</button>
        </div>
      </header>

      {summary && (
        <SessionSummary
          sessionId={sid}
          title={session?.title ?? ''}
          players={players ?? []}
          onClose={() => {
            setSummary(false)
            if (session?.status === 'closed') nav('/')
          }}
        />
      )}

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* editable 開團名稱 — tap to rename (this is what 臨打人 see) */}
        {editTitle ? (
          <div className="flex gap-2">
            <input
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveTitle()
                if (e.key === 'Escape') setEditTitle(false)
              }}
              maxLength={20}
              autoFocus
              className="flex-1 text-xl font-extrabold border-2 border-brand-pink rounded-2xl px-3 py-1.5
                focus:outline-none"
            />
            <button onClick={saveTitle} disabled={!titleInput.trim() || savingTitle} className="btn-primary px-4 text-sm disabled:opacity-40">
              {savingTitle ? '…' : '儲存'}
            </button>
            <button onClick={() => setEditTitle(false)} className="btn-secondary px-3 text-sm">取消</button>
          </div>
        ) : (
          <button
            onClick={() => {
              setTitleInput(session?.title ?? '')
              setEditTitle(true)
            }}
            className="flex items-center gap-2 text-left group"
            title="點一下改開團名稱"
          >
            <span className="text-xl font-extrabold text-gray-800">
              {session?.title?.trim() ? session.title : '未命名開團'}
            </span>
            <span className="text-gray-300 group-hover:text-brand-pink text-base">✏️</span>
          </button>
        )}

        {/* QR code share */}
        <div className="card">
          <button
            onClick={() => setShowQR(!showQR)}
            className="w-full flex items-center justify-between font-bold text-gray-700"
          >
            <span>📲 邀請臨打人(掃碼進場)</span>
            <span className="text-gray-300">{showQR ? '收起' : '展開'}</span>
          </button>
          {showQR && (
            <div className="flex flex-col items-center mt-4 space-y-3">
              <div className="bg-white p-3 rounded-2xl shadow-inner">
                <QRCodeSVG value={joinUrl} size={180} />
              </div>
              <div className="flex items-center gap-2 w-full">
                <input
                  readOnly
                  value={joinUrl}
                  className="flex-1 text-xs bg-gray-50 rounded-xl px-3 py-2 text-gray-500"
                />
                <button
                  onClick={() => navigator.clipboard.writeText(joinUrl)}
                  className="btn-secondary px-3 py-2 text-xs"
                >
                  複製
                </button>
              </div>
              <button onClick={() => setPoster(true)} className="btn-primary w-full text-sm">
                🖥 海報模式(全螢幕大 QR)
              </button>
            </div>
          )}
        </div>

        {/* full-screen QR poster — stand the phone/laptop at the door */}
        {poster && (
          <div
            className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 text-center"
            onClick={() => setPoster(false)}
          >
            <div className="text-5xl mb-4">🏸</div>
            <p className="text-2xl font-extrabold text-gray-800">
              {session?.title?.trim() ? session.title : '羽球揪團'}
            </p>
            <p className="text-gray-400 mb-6">掃我加入,選位置上場</p>
            <div className="bg-white p-4 rounded-3xl shadow-xl border">
              <QRCodeSVG value={joinUrl} size={Math.min(360, window.innerWidth - 80)} />
            </div>
            <p className="text-gray-300 text-sm mt-8">點任一處關閉</p>
          </div>
        )}

        {/* on-site seating board — seat phone-less players from the tablet */}
        <button
          onClick={() => setBoard(true)}
          className="w-full btn-primary py-3 text-base"
        >
          🏸 現場排點板(代排上下場)
        </button>
        {board && <SeatingBoard sessionId={sid} onClose={() => setBoard(false)} />}

        {/* per-session settings (location / contact link / gate code / times) in a modal */}
        <button onClick={() => setSettingsOpen(true)} className="btn-secondary w-full text-sm">
          ⚙️ 這場設定(地點 / 連結 / 密碼 / 時間)
        </button>
        {settingsOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
            onClick={() => setSettingsOpen(false)}
          >
            <div
              className="w-full max-w-sm space-y-3 max-h-[88vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-end">
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="text-white font-bold text-sm bg-black/30 rounded-full px-3 py-1"
                >
                  ✕ 關閉
                </button>
              </div>
              <LocationCard sessionId={sid} city={session?.city} district={session?.district} />
              <ContactCard sessionId={sid} contactUrl={session?.contact_url} description={session?.description} />
              <SignupSettingsCard sessionId={sid} view={session} />
              <FairPlayCard sessionId={sid} view={session} />
              <PasswordCard sessionId={sid} />
              <TimesCard
                sessionId={sid}
                startAt={session?.start_at}
                endAt={session?.end_at}
                queueOpenAt={session?.queue_open_at}
              />
            </div>
          </div>
        )}

        {/* 🙋 臨打報名審核 — 獨立於成員列表,有 pending 報名才出現 */}
        <SignupReviewPanel
          view={session}
          players={players ?? []}
          busy={approveFamily.isPending || removePlayer.isPending}
          onApprove={async (p, overQuota) => {
            if (overQuota && !(await confirm({
              message: `名額已滿,確定還要核准「${p.display_name}」嗎?`,
              confirmText: '核准',
            }))) return
            approveFamily.mutate(p.player_id)
          }}
          onReject={async (p) => {
            if (await confirm({
              message: `婉拒「${p.display_name}」的報名?對方不會收到通知,之後還是可以再報名。`,
              confirmText: '婉拒',
              danger: true,
            })) removePlayer.mutate(p.player_id)
          }}
        />

        {/* people in this session — 報名中(等核准)的人在上面的審核區,不列進成員 */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-gray-700">本場人員</span>
            <span className="text-xs text-gray-400">
              已到 <span className="font-bold text-emerald-600">
                {roster.filter((p) => p.claimed).length}
              </span> / 共 {roster.length} 人
              　💰 已收臨打費 <span className="font-bold text-amber-500">
                {roster.filter((p) => p.paid).length}
              </span>
            </span>
          </div>

          {/* filter: search + 未到 toggle */}
          {roster.length > 0 && (
            <div className="flex gap-2">
              <input
                value={memberFilter}
                onChange={(e) => setMemberFilter(e.target.value)}
                placeholder="🔍 搜尋名字"
                className="flex-1 border-2 border-gray-200 rounded-2xl px-3 py-1.5 text-sm
                  focus:outline-none focus:border-brand-pink"
              />
              <button
                onClick={() => setOnlyUnclaimed(!onlyUnclaimed)}
                className={`px-3 rounded-2xl text-sm font-bold shrink-0 ${
                  onlyUnclaimed ? 'bg-brand-pink text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                只看未到
              </button>
              <button
                onClick={() => setOnlyUnpaid(!onlyUnpaid)}
                className={`px-3 rounded-2xl text-sm font-bold shrink-0 ${
                  onlyUnpaid ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                只看沒繳錢
              </button>
            </div>
          )}

          {/* current people — tap to set level; ● = 已到, 未到 = 還沒掃碼認領 */}
          <div className="flex flex-wrap gap-2">
            {roster
              .filter((p) => p.display_name.includes(memberFilter.trim()))
              .filter((p) => (onlyUnclaimed ? !p.claimed : true))
              .filter((p) => (onlyUnpaid ? !p.paid : true))
              .slice()
              .sort((a, b) => Number(b.claimed) - Number(a.claimed)) // 未到的排最後
              .map((p) => {
              const tier = tierOf(p.level)
              return (
                <button
                  key={p.player_id}
                  onClick={() => {
                    const next = levelTarget === p.player_id ? null : p.player_id
                    setLevelTarget(next)
                    setRenameInput(next ? p.display_name : '')
                  }}
                  className={`pl-1 pr-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1.5
                    ${tier ? tier.chip : 'bg-gray-100 text-gray-500'} ${p.claimed ? '' : 'opacity-50'}`}
                >
                  <MiniAvatar slot={p} />
                  {p.display_name}
                  {dup[p.player_id] && (
                    <span className="text-[10px] text-gray-400 font-bold">#{dup[p.player_id]}</span>
                  )}
                  <span className="bg-white/70 text-gray-700 rounded-full px-1.5 text-xs">
                    {p.level > 0 ? `Lv${p.level}` : '?'}
                  </span>
                  {p.paid && <span className="text-[11px]" title="已收臨打費">💰</span>}
                  {p.owner_id && (
                    <span className="text-[10px] text-violet-500" title={ownerLabel(p)}>👪</span>
                  )}
                  {p.is_temp && !p.owner_id && (
                    <span className="text-[10px] text-sky-500" title="團主現場加入(無手機)">🏸現場</span>
                  )}
                  {p.pending && <span className="text-[10px] font-bold text-orange-500">待核准</span>}
                  {!p.claimed && <span className="text-[10px] text-gray-400">未到</span>}
                </button>
              )
            })}
            {(players ?? []).length === 0 && (
              <span className="text-sm text-gray-300">還沒有人,從下面加入</span>
            )}
          </div>

          {/* level editor for the tapped player */}
          {levelTarget && (
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold">
                設定
                {targetPlayer && <MiniAvatar slot={targetPlayer} />}
                「{targetPlayer?.display_name}
                {targetPlayer && dup[targetPlayer.player_id] ? ` #${dup[targetPlayer.player_id]}` : ''}」
                {targetPlayer?.owner_id && (
                  <span className="text-[11px] text-violet-500">👪 {ownerLabel(targetPlayer)}</span>
                )}
                {targetPlayer?.is_temp && !targetPlayer?.owner_id && (
                  <span className="text-[11px] text-sky-500">🏸 現場加入</span>
                )}
              </div>
              {/* 家人待核准 → 核准鈕 */}
              {targetPlayer?.pending && (
                <button
                  onClick={() => approveFamily.mutate(targetPlayer.player_id)}
                  disabled={approveFamily.isPending}
                  className="w-full rounded-2xl py-2 text-sm font-bold bg-emerald-500 text-white disabled:opacity-40"
                >
                  ✅ 核准這位家人(核准後才能上場/排隊)
                </button>
              )}
              {/* 改本場名稱 */}
              <div className="flex gap-2">
                <input
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  onKeyDown={(e) => {
                    const n = renameInput.trim()
                    if (e.key === 'Enter' && n) setPlayerName.mutate({ playerId: levelTarget, name: n })
                  }}
                  placeholder="改名字"
                  className="flex-1 border-2 border-gray-200 rounded-2xl px-3 py-1.5 text-sm
                    focus:outline-none focus:border-brand-pink"
                />
                <button
                  onClick={() => {
                    const n = renameInput.trim()
                    if (n) setPlayerName.mutate({ playerId: levelTarget, name: n })
                  }}
                  disabled={!renameInput.trim() || setPlayerName.isPending}
                  className="px-3 rounded-2xl text-sm font-bold bg-brand-pink text-white disabled:opacity-40"
                >
                  改名
                </button>
              </div>
              {/* 臨打費 */}
              {(() => {
                const paid = (players ?? []).find((p) => p.player_id === levelTarget)?.paid ?? false
                return (
                  <button
                    onClick={() => setPaid.mutate({ playerId: levelTarget, paid: !paid })}
                    disabled={setPaid.isPending}
                    className={`w-full rounded-2xl py-2 text-sm font-bold border-2 ${
                      paid
                        ? 'bg-amber-50 border-amber-300 text-amber-600'
                        : 'bg-gray-50 border-gray-200 text-gray-400'
                    }`}
                  >
                    {paid ? '💰 已收臨打費(點一下取消)' : '尚未收臨打費(點一下標記已收)'}
                  </button>
                )
              })()}
              <p className="text-xs text-gray-400 font-semibold pt-1">程度</p>
              <div className="flex flex-wrap gap-1.5">
                {TIERS.flatMap((t) =>
                  Array.from({ length: t.max - t.min + 1 }, (_, i) => t.min + i).map((lv) => (
                    <button
                      key={lv}
                      onClick={() => {
                        setLevel.mutate({ playerId: levelTarget, level: lv })
                        setLevelTarget(null)
                      }}
                      className={`w-8 h-8 rounded-lg text-sm font-bold ${t.chip}`}
                    >
                      {lv}
                    </button>
                  ))
                )}
                <button
                  onClick={() => {
                    setLevel.mutate({ playerId: levelTarget, level: 0 })
                    setLevelTarget(null)
                  }}
                  className="px-3 h-8 rounded-lg text-xs font-bold bg-gray-100 text-gray-500"
                >
                  清除等級
                </button>
              </div>
              <button
                onClick={async () => {
                  const name = (players ?? []).find((p) => p.player_id === levelTarget)?.display_name
                  if (await confirm({ message: `斷開「${name}」?他會被移出本場、無法再操作(可重新加入)。`, confirmText: '斷開', danger: true })) {
                    removePlayer.mutate(levelTarget)
                    setLevelTarget(null)
                  }
                }}
                className="w-full text-xs font-bold text-red-400 border-2 border-red-200 rounded-2xl py-2"
              >
                🚫 斷開此人(移出本場)
              </button>
            </div>
          )}

          {/* add a brand-new name */}
          <div className="border-t pt-3 flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newName.trim()) {
                  addPlayer.mutate(newName.trim())
                  setNewName('')
                }
              }}
              placeholder="臨時加一個新名字"
              className="flex-1 border-2 border-gray-200 rounded-2xl px-3 py-2 text-sm
                focus:outline-none focus:border-brand-pink"
            />
            <button
              onClick={() => {
                if (newName.trim()) {
                  addPlayer.mutate(newName.trim())
                  setNewName('')
                }
              }}
              disabled={addPlayer.isPending}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-40"
            >
              加入
            </button>
          </div>
        </div>

        {/* add court */}
        <div className="flex justify-end">
          <button onClick={() => addCourt.mutate()} className="btn-secondary text-sm py-2">
            ＋ 臨時加一個球場
          </button>
        </div>

        {/* courts */}
        <div className="grid gap-4 sm:grid-cols-2">
          {session?.courts.map((court) => (
            <div key={court.court_id} className="space-y-2">
              <ManageCourtCard
                court={court}
                onEnd={() => endCourt.mutate(court.court_id)}
                onUndoEnd={() => undoEnd.mutate(court.court_id)}
                onKick={(playerId) => kick.mutate({ courtId: court.court_id, playerId })}
                onRename={(name) => renameCourt.mutate({ courtId: court.court_id, name })}
                onSwapQueue={
                  // 入口在「有別的場地、且任一邊有人排隊」時出現(沒人排隊的場地
                  // 也能把別場的人換過來)
                  (session?.courts.length ?? 0) > 1 &&
                  (court.queue.length > 0 ||
                    (session?.courts ?? []).some((c) => c.court_id !== court.court_id && c.queue.length > 0))
                    ? () => setSwapSource(court.court_id)
                    : undefined
                }
                onRemove={async () => {
                  const hasPlaying = court.playing.some((p) => p.player_id)
                  const msg = hasPlaying
                    ? '刪除這個場地?場上的人會計入統計(視同結束),排隊的人會被取消排隊。'
                    : '刪除這個場地?'
                  if (await confirm({ message: msg, confirmText: '刪除', danger: true })) {
                    removeCourt.mutate(court.court_id)
                  }
                }}
              />
              <button
                onClick={() => setAddTarget(addTarget === court.court_id ? null : court.court_id)}
                className="w-full text-xs text-brand-pink font-semibold py-1"
              >
                {addTarget === court.court_id ? '收起' : '＋ 手動加人(上場 / 排隊)'}
              </button>
              {addTarget === court.court_id && (() => {
                const playingFull = court.playing.filter((x) => x.player_id).length >= 4
                const queueFull = court.queue.length >= 4
                // exclude anyone already on ANY court (playing or queue) — one court per person
                const busy = new Set(
                  (session?.courts ?? [])
                    .flatMap((ct) => [...ct.playing.map((x) => x.player_id), ...ct.queue.map((x) => x.player_id)])
                    .filter(Boolean)
                )
                // fair rotation: surface whoever has played least so the leader
                // can seat the fairest next. 未到 (not here yet) sink to the bottom
                // and never get the 建議 badge — they're not physically on court.
                const candidates = (players ?? [])
                  .filter((p) => !busy.has(p.player_id))
                  .filter((p) => !p.pending) // 待核准的家人不能排
                  .filter((p) => p.display_name.includes(addFilter.trim()))
                  .slice()
                  .sort((a, b) => {
                    if (a.claimed !== b.claimed) return Number(b.claimed) - Number(a.claimed)
                    if (a.games !== b.games) return a.games - b.games
                    if (a.total_minutes !== b.total_minutes) return a.total_minutes - b.total_minutes
                    return a.display_name.localeCompare(b.display_name)
                  })
                const present = candidates.filter((p) => p.claimed)
                const minGames = present.length ? Math.min(...present.map((p) => p.games)) : 0
                const maxGames = present.length ? Math.max(...present.map((p) => p.games)) : 0
                // only suggest once a real fairness gap exists (skip the all-0 start)
                const suggest = (p: SessionPlayer) => maxGames > minGames && p.claimed && p.games === minGames
                return (
                  <div className="card space-y-2">
                    <input
                      value={addFilter}
                      onChange={(e) => setAddFilter(e.target.value)}
                      placeholder="🔍 搜尋名字"
                      className="w-full border-2 border-gray-200 rounded-2xl px-3 py-1.5 text-sm
                        focus:outline-none focus:border-brand-pink"
                    />
                    <p className="text-[11px] text-gray-400">⚖️ 依公平排序:打最少場的排在最前面</p>
                    <div className="max-h-60 overflow-y-auto space-y-1.5">
                      {candidates.map((p) => {
                        const sug = suggest(p)
                        return (
                        <div
                          key={p.player_id}
                          className={`flex items-center justify-between gap-2 rounded-xl px-1.5 py-0.5
                            ${sug ? 'bg-brand-mint/40' : ''}`}
                        >
                          <div className="min-w-0 flex items-center gap-1.5">
                            <MiniAvatar slot={p} />
                            <span className="text-sm font-semibold text-gray-600 truncate">{p.display_name}</span>
                            {dup[p.player_id] && (
                              <span className="shrink-0 text-[10px] text-gray-400 font-bold">#{dup[p.player_id]}</span>
                            )}
                            {sug && (
                              <span className="shrink-0 text-[10px] font-bold text-emerald-700
                                bg-white rounded-full px-1.5 py-0.5">⭐ 建議</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] text-gray-400 tabular-nums">
                              {p.claimed ? `${p.games} 場` : '未到'}
                            </span>
                            <div className="flex gap-1">
                            <button
                              disabled={playingFull}
                              onClick={() => { addPlaying.mutate({ courtId: court.court_id, playerId: p.player_id }); setAddTarget(null); setAddFilter('') }}
                              className="px-2.5 py-1 rounded-full text-xs font-bold bg-brand-mint text-emerald-700 disabled:opacity-30"
                            >
                              上場
                            </button>
                            <button
                              disabled={queueFull}
                              onClick={() => { addQueue.mutate({ courtId: court.court_id, playerId: p.player_id }); setAddTarget(null); setAddFilter('') }}
                              className="px-2.5 py-1 rounded-full text-xs font-bold bg-brand-yellow text-amber-700 disabled:opacity-30"
                            >
                              排隊
                            </button>
                            </div>
                          </div>
                        </div>
                        )
                      })}
                      {candidates.length === 0 && (
                        <span className="text-sm text-gray-300">沒有可加入的人</span>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
          ))}
        </div>

        {/* 排隊交換(不常用 → 從場地卡排隊列的 ⇄ 進來) */}
        {swapSource && session && (
          <SwapQueueModal
            courts={session.courts}
            sourceCourtId={swapSource}
            pending={swapQueue.isPending}
            onClose={() => setSwapSource(null)}
            onConfirm={(pick) =>
              swapQueue.mutate(pick, { onSuccess: () => setSwapSource(null) })
            }
          />
        )}

        {/* stats dashboard */}
        <StatsPanel sessionId={sid} players={roster} />

        {/* 團主操作紀錄 */}
        <ActionLogPanel sessionId={sid} />

        <p className="text-center text-xs text-gray-300">⚡ 即時同步 · 已報到 {players?.length ?? 0} 人</p>
      </div>
    </div>
  )
}
