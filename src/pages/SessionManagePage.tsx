import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { sessionApi } from '../api/client'
import { useSessionView, useSessionPlayers, useManageActions, useMembers } from '../hooks/useApi'
import { ManageCourtCard } from '../components/ManageCourtCard'
import { StatsPanel } from '../components/StatsPanel'
import { TIERS, tierOf } from '../lib/levels'

const BOOKING_URL = import.meta.env.VITE_BOOKING_URL || 'http://localhost:5174'

export function SessionManagePage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const nav = useNavigate()
  const sid = sessionId ?? ''

  const { data: session, isLoading } = useSessionView(sid)
  const { data: players } = useSessionPlayers(sid)
  const { data: roster } = useMembers()
  const { endCourt, kick, addPlaying, addCourt, addPlayer, setLevel } = useManageActions(sid)

  const [showQR, setShowQR] = useState(true)
  const [addTarget, setAddTarget] = useState<string | null>(null) // court_id to add a player to
  const [newName, setNewName] = useState('')
  const [levelTarget, setLevelTarget] = useState<string | null>(null) // player_id being re-leveled

  // roster members not yet in this session (available to quick-add)
  const inSession = new Set((players ?? []).map((p) => p.display_name))
  const rosterAvailable = (roster ?? []).filter((m) => !inSession.has(m.display_name))

  const joinUrl = `${BOOKING_URL}/?s=${sid}`

  async function closeSession() {
    if (!confirm('確定要結束這次開團嗎?')) return
    await sessionApi.close(sid)
    nav('/')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-4xl animate-bounce">🏸</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg pb-10">
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <button onClick={() => nav('/')} className="text-sm text-gray-400">← 返回</button>
        <span className="font-extrabold text-gray-800">場中管理</span>
        <button onClick={closeSession} className="text-sm font-semibold text-red-400">結束開團</button>
      </header>

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
            </div>
          )}
        </div>

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

          {/* current people — tap to set level; ● = 已到, 未到 = 還沒掃碼認領 */}
          <div className="flex flex-wrap gap-2">
            {(players ?? []).map((p) => {
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
                  清除
                </button>
              </div>
            </div>
          )}

          {/* quick-add from roster */}
          {rosterAvailable.length > 0 && (
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs text-gray-400">從常駐名單加入(點一下)</p>
              <div className="flex flex-wrap gap-2">
                {rosterAvailable.map((m) => (
                  <button
                    key={m.member_id}
                    onClick={() => addPlayer.mutate(m.display_name)}
                    className="px-3 py-1.5 rounded-full text-sm font-semibold bg-gray-100 text-gray-600
                      hover:bg-brand-pink hover:text-white transition-colors"
                  >
                    ＋ {m.display_name}
                  </button>
                ))}
              </div>
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
                onKick={(playerId) => kick.mutate({ courtId: court.court_id, playerId })}
              />
              {court.playing.length < 4 && (
                <button
                  onClick={() => setAddTarget(addTarget === court.court_id ? null : court.court_id)}
                  className="w-full text-xs text-brand-pink font-semibold py-1"
                >
                  {addTarget === court.court_id ? '收起' : '＋ 手動把人加到場上'}
                </button>
              )}
              {addTarget === court.court_id && (
                <div className="card flex flex-wrap gap-2">
                  {(players ?? []).map((p) => (
                    <button
                      key={p.player_id}
                      onClick={() => {
                        addPlaying.mutate({ courtId: court.court_id, playerId: p.player_id })
                        setAddTarget(null)
                      }}
                      className="px-3 py-1.5 rounded-full text-sm font-semibold bg-gray-100 text-gray-600
                        hover:bg-brand-pink hover:text-white transition-colors"
                    >
                      {p.display_name}
                    </button>
                  ))}
                  {(players ?? []).length === 0 && (
                    <span className="text-sm text-gray-300">還沒有人進場</span>
                  )}
                </div>
              )}
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
