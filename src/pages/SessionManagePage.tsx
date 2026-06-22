import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { sessionApi } from '../api/client'
import { useSessionView, useSessionPlayers, useManageActions } from '../hooks/useApi'
import { ManageCourtCard } from '../components/ManageCourtCard'

const BOOKING_URL = import.meta.env.VITE_BOOKING_URL || 'http://localhost:5174'

export function SessionManagePage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const nav = useNavigate()
  const sid = sessionId ?? ''

  const { data: session, isLoading } = useSessionView(sid)
  const { data: players } = useSessionPlayers(sid)
  const { endCourt, kick, addPlaying, addCourt } = useManageActions(sid)

  const [showQR, setShowQR] = useState(true)
  const [addTarget, setAddTarget] = useState<string | null>(null) // court_id to add a player to

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

        <p className="text-center text-xs text-gray-300">每 3 秒自動更新 · 共 {players?.length ?? 0} 人在場</p>
      </div>
    </div>
  )
}
