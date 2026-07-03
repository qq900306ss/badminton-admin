import { useEffect, useState } from 'react'
import type { CourtView, PlayerSlot } from '../api/client'
import { isPhotoUrl } from '../lib/avatar'

// 交換排隊 modal:把來源場地排隊中的一個人,跟另一個場地排隊中的一個人互換。
// 從 ManageCourtCard 排隊列的「⇄ 跟別場交換」進來(不常用 → 平常完全不佔版面,
// 只在兩邊都有人排隊時才有入口)。

interface Props {
  courts: CourtView[]
  sourceCourtId: string
  pending: boolean
  onConfirm: (pick: { courtA: string; playerA: string; courtB: string; playerB: string }) => void
  onClose: () => void
}

function courtTitle(c: CourtView) {
  return c.name?.trim() ? c.name : `場地 ${c.court_num}`
}

function QueueChip({ slot, selected, onClick }: { slot: PlayerSlot; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-sm font-semibold border-2 transition-colors
        ${selected ? 'border-brand-pink bg-brand-pink/10 text-brand-pink' : 'border-gray-200 text-gray-600'}`}
    >
      <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-xs overflow-hidden">
        {isPhotoUrl(slot.avatar_url) ? (
          <img src={slot.avatar_url} alt="" className="w-full h-full object-cover" />
        ) : slot.avatar_url ? (
          slot.avatar_url
        ) : (
          [...(slot.display_name ?? '')][0]?.toUpperCase()
        )}
      </span>
      {slot.display_name}
    </button>
  )
}

export function SwapQueueModal({ courts, sourceCourtId, pending, onConfirm, onClose }: Props) {
  const [playerA, setPlayerA] = useState<string | null>(null)
  const [target, setTarget] = useState<{ courtB: string; playerB: string } | null>(null)

  const source = courts.find((c) => c.court_id === sourceCourtId)
  const others = courts.filter((c) => c.court_id !== sourceCourtId && c.queue.length > 0)
  // 名單可能在打開後被 WS 更新到空 → 直接關掉比留一個空殼好
  const shouldClose = !source || source.queue.length === 0 || others.length === 0
  useEffect(() => {
    if (shouldClose) onClose()
  }, [shouldClose, onClose])
  if (shouldClose || !source) return null
  const ready = playerA !== null && target !== null

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="bg-white rounded-3xl p-5 w-full max-w-sm max-h-[80vh] overflow-y-auto space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="font-extrabold text-gray-800">⇄ 交換排隊</span>
          <button onClick={onClose} className="text-gray-400 font-bold">✕</button>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-bold text-gray-400">
            {courtTitle(source)} — 選要換出去的人
          </p>
          <div className="flex flex-wrap gap-2">
            {source.queue.map((p) => (
              <QueueChip
                key={p.player_id}
                slot={p}
                selected={playerA === p.player_id}
                onClick={() => setPlayerA(playerA === p.player_id ? null : p.player_id)}
              />
            ))}
          </div>
        </div>

        {others.map((c) => (
          <div key={c.court_id} className="space-y-1.5">
            <p className="text-xs font-bold text-gray-400">{courtTitle(c)} — 選要換過來的人</p>
            <div className="flex flex-wrap gap-2">
              {c.queue.map((p) => (
                <QueueChip
                  key={p.player_id}
                  slot={p}
                  selected={target?.courtB === c.court_id && target?.playerB === p.player_id}
                  onClick={() =>
                    setTarget(
                      target?.playerB === p.player_id ? null : { courtB: c.court_id, playerB: p.player_id }
                    )
                  }
                />
              ))}
            </div>
          </div>
        ))}

        <button
          disabled={!ready || pending}
          onClick={() => {
            if (playerA && target) onConfirm({ courtA: sourceCourtId, playerA, ...target })
          }}
          className="btn-primary w-full text-sm disabled:opacity-40"
        >
          {ready ? '⇄ 確認交換' : '兩邊各選一個人'}
        </button>
      </div>
    </div>
  )
}
