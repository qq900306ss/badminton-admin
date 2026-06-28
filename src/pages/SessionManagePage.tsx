import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { sessionApi } from '../api/client'
import type { SessionPlayer } from '../api/client'
import { useSessionView, useSessionPlayers, useManageActions } from '../hooks/useApi'
import { ManageCourtCard } from '../components/ManageCourtCard'
import { StatsPanel } from '../components/StatsPanel'
import { SessionSummary } from '../components/SessionSummary'
import { PasswordCard } from '../components/PasswordCard'
import { SeatingBoard } from '../components/SeatingBoard'
import { useConfirm } from '../components/Confirm'
import { CourtSkeleton } from '../components/Skeleton'
import { TIERS, tierOf } from '../lib/levels'
import { connectSessionWS } from '../lib/realtime'

const BOOKING_URL = import.meta.env.VITE_BOOKING_URL || 'http://localhost:5174'

export function SessionManagePage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const nav = useNavigate()
  const sid = sessionId ?? ''

  const { data: session, isLoading } = useSessionView(sid)
  const { data: players } = useSessionPlayers(sid)
  const { endCourt, undoEnd, kick, addPlaying, addCourt, addPlayer, setLevel, renameCourt, removeCourt, addQueue, removePlayer } = useManageActions(sid)
  const confirm = useConfirm()
  const qc = useQueryClient()

  // real-time: refetch the moment anything changes (players, courts, seating)
  useEffect(() => {
    if (!sid) return
    return connectSessionWS(sid, () => {
      qc.invalidateQueries({ queryKey: ['session', sid] })
      qc.invalidateQueries({ queryKey: ['session-players', sid] })
    })
  }, [sid, qc])

  const [showQR, setShowQR] = useState(true)
  const [poster, setPoster] = useState(false)
  const [summary, setSummary] = useState(false)
  const [addTarget, setAddTarget] = useState<string | null>(null) // court_id to add a player to
  const [newName, setNewName] = useState('')
  const [levelTarget, setLevelTarget] = useState<string | null>(null) // player_id being re-leveled
  const [memberFilter, setMemberFilter] = useState('')
  const [onlyUnclaimed, setOnlyUnclaimed] = useState(false)
  const [addFilter, setAddFilter] = useState('')
  const [board, setBoard] = useState(false)

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

        {/* gate code — view + change */}
        <PasswordCard sessionId={sid} />

        {/* people in this session */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-gray-700">本場人員</span>
            <span className="text-xs text-gray-400">
              已到 <span className="font-bold text-emerald-600">
                {(players ?? []).filter((p) => p.claimed).length}
              </span> / 共 {players?.length ?? 0} 人
            </span>
          </div>

          {/* filter: search + 未到 toggle */}
          {(players ?? []).length > 0 && (
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
            </div>
          )}

          {/* current people — tap to set level; ● = 已到, 未到 = 還沒掃碼認領 */}
          <div className="flex flex-wrap gap-2">
            {(players ?? [])
              .filter((p) => p.display_name.includes(memberFilter.trim()))
              .filter((p) => (onlyUnclaimed ? !p.claimed : true))
              .slice()
              .sort((a, b) => Number(b.claimed) - Number(a.claimed)) // 未到的排最後
              .map((p) => {
              const tier = tierOf(p.level)
              return (
                <button
                  key={p.player_id}
                  onClick={() => setLevelTarget(levelTarget === p.player_id ? null : p.player_id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold flex items-center gap-1.5
                    ${tier ? tier.chip : 'bg-gray-100 text-gray-500'} ${p.claimed ? '' : 'opacity-50'}`}
                >
                  <span className={p.claimed ? 'text-emerald-600' : 'text-gray-300'}>●</span>
                  {p.display_name}
                  <span className="bg-white/70 text-gray-700 rounded-full px-1.5 text-xs">
                    {p.level > 0 ? `Lv${p.level}` : '?'}
                  </span>
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
              <p className="text-xs text-gray-500 font-semibold">
                設定「{(players ?? []).find((p) => p.player_id === levelTarget)?.display_name}」的程度
              </p>
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
              className="btn-primary px-4 py-2 text-sm"
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
                            <span className="text-sm font-semibold text-gray-600 truncate">{p.display_name}</span>
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

        {/* stats dashboard */}
        <StatsPanel sessionId={sid} players={players ?? []} />

        <p className="text-center text-xs text-gray-300">每 3 秒自動更新 · 已報到 {players?.length ?? 0} 人</p>
      </div>
    </div>
  )
}
