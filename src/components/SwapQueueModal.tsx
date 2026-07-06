import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CourtView, PlayerSlot } from '../api/client'
import { isPhotoUrl } from '../lib/avatar'

// 交換排隊 modal:把來源場地排隊中的人跟另一個場地排隊中的人互換。兩邊可多選、
// 可不等量(一邊 0 人=單純把人移過去/換過來),唯一限制是交換後兩邊排隊各 ≤ 4,
// 超過時紅字提醒並鎖住確認鈕。從 ManageCourtCard 排隊列的「⇄ 跟別場交換」進來。

const QUEUE_CAP = 4

interface Props {
  courts: CourtView[]
  sourceCourtId: string
  pending: boolean
  onConfirm: (pick: { courtA: string; playersA: string[]; courtB: string; playersB: string[] }) => void
  onClose: () => void
}

function QueueChip({ slot, selected, dimmed, onClick }: {
  slot: PlayerSlot; selected: boolean; dimmed: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-sm font-semibold border-2 transition-colors
        ${selected ? 'border-brand-pink bg-brand-pink/10 text-brand-pink' : 'border-gray-200 text-gray-600'}
        ${dimmed ? 'opacity-40' : ''}`}
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

function toggle(set: Set<string>, id: string): Set<string> {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

export function SwapQueueModal({ courts, sourceCourtId, pending, onConfirm, onClose }: Props) {
  const { t } = useTranslation()
  const courtTitle = (c: CourtView) => (c.name?.trim() ? c.name : t('SwapQueueModal.courtN', { n: c.court_num }))
  const [picksA, setPicksA] = useState<Set<string>>(new Set())
  const [targetId, setTargetId] = useState<string | null>(null)
  const [picksB, setPicksB] = useState<Set<string>>(new Set())

  const source = courts.find((c) => c.court_id === sourceCourtId)
  const others = courts.filter((c) => c.court_id !== sourceCourtId)
  const anyQueue = (source?.queue.length ?? 0) > 0 || others.some((c) => c.queue.length > 0)
  // 名單可能在打開後被 WS 更新到沒東西可換 → 直接關掉比留一個空殼好
  const shouldClose = !source || others.length === 0 || !anyQueue
  useEffect(() => {
    if (shouldClose) onClose()
  }, [shouldClose, onClose])

  // WS 更新可能把已選的人移出排隊 → 把失效的選擇自動剔除
  useEffect(() => {
    if (!source) return
    const inQueue = new Set(source.queue.map((p) => p.player_id))
    if ([...picksA].some((id) => !inQueue.has(id))) {
      setPicksA(new Set([...picksA].filter((id) => inQueue.has(id))))
    }
  }, [source, picksA])
  useEffect(() => {
    const target = courts.find((c) => c.court_id === targetId)
    if (!target) return
    const inQueue = new Set(target.queue.map((p) => p.player_id))
    if ([...picksB].some((id) => !inQueue.has(id))) {
      setPicksB(new Set([...picksB].filter((id) => inQueue.has(id))))
    }
  }, [courts, targetId, picksB])

  if (shouldClose || !source) return null

  const target = others.find((c) => c.court_id === targetId) ?? null
  const totalPicked = picksA.size + picksB.size

  // 交換後兩邊的排隊人數 — 超過上限就提醒並擋下
  const srcAfter = source.queue.length - picksA.size + picksB.size
  const tgtAfter = target ? target.queue.length - picksB.size + picksA.size : 0
  const overCourts: string[] = []
  if (srcAfter > QUEUE_CAP) overCourts.push(t('SwapQueueModal.overItem', { name: courtTitle(source), n: srcAfter }))
  if (target && tgtAfter > QUEUE_CAP) overCourts.push(t('SwapQueueModal.overItem', { name: courtTitle(target), n: tgtAfter }))
  const ready = target !== null && totalPicked > 0 && overCourts.length === 0

  function pickTarget(courtId: string) {
    if (targetId !== courtId) {
      setTargetId(courtId)
      setPicksB(new Set()) // 換對象場地 → 之前選的人作廢
    }
  }

  const confirmLabel = !target
    ? t('SwapQueueModal.pickCourt')
    : totalPicked === 0
      ? t('SwapQueueModal.pickPlayers')
      : picksA.size === 0
        ? t('SwapQueueModal.bringOver')
        : picksB.size === 0
          ? t('SwapQueueModal.moveAway')
          : t('SwapQueueModal.confirmSwap')

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="bg-white rounded-3xl p-5 w-full max-w-sm max-h-[80vh] overflow-y-auto space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="font-extrabold text-gray-800">⇄ {t('SwapQueueModal.title')}</span>
          <button onClick={onClose} className="text-gray-400 font-bold">✕</button>
        </div>
        <p className="text-xs text-gray-400">
          {t('SwapQueueModal.intro', { cap: QUEUE_CAP })}
        </p>

        <div className="space-y-1.5">
          <p className="text-xs font-bold text-gray-400">
            {courtTitle(source)} {t('SwapQueueModal.sourceLabel', { n: source.queue.length, cap: QUEUE_CAP })}
          </p>
          {source.queue.length === 0 ? (
            <p className="text-sm text-gray-300">{t('SwapQueueModal.noQueueSource')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {source.queue.map((p) => (
                <QueueChip
                  key={p.player_id}
                  slot={p}
                  selected={picksA.has(p.player_id)}
                  dimmed={false}
                  onClick={() => setPicksA(toggle(picksA, p.player_id))}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-400">{t('SwapQueueModal.whichCourt')}</p>
          {others.map((c) => {
            const isTarget = targetId === c.court_id
            return (
              <div
                key={c.court_id}
                className={`rounded-2xl border-2 p-2.5 space-y-1.5 transition-colors
                  ${isTarget ? 'border-brand-pink' : 'border-gray-100'}`}
              >
                <button
                  onClick={() => pickTarget(c.court_id)}
                  className="w-full flex items-center gap-2 text-left"
                >
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0
                    ${isTarget ? 'border-brand-pink' : 'border-gray-300'}`}>
                    {isTarget && <span className="w-2 h-2 rounded-full bg-brand-pink" />}
                  </span>
                  <span className={`text-sm font-bold ${isTarget ? 'text-brand-pink' : 'text-gray-600'}`}>
                    {courtTitle(c)}
                  </span>
                  <span className="text-[11px] text-gray-400">{t('SwapQueueModal.queueCount', { n: c.queue.length, cap: QUEUE_CAP })}</span>
                </button>
                {c.queue.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {c.queue.map((p) => (
                      <QueueChip
                        key={p.player_id}
                        slot={p}
                        selected={isTarget && picksB.has(p.player_id)}
                        dimmed={targetId !== null && !isTarget}
                        onClick={() => {
                          if (!isTarget) {
                            pickTarget(c.court_id)
                            setPicksB(new Set([p.player_id]))
                          } else {
                            setPicksB(toggle(picksB, p.player_id))
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {overCourts.length > 0 && (
          <p className="text-xs font-bold text-red-500">
            ⚠️ {t('SwapQueueModal.overWarning', { courts: overCourts.join(t('SwapQueueModal.sep')), cap: QUEUE_CAP })}
          </p>
        )}
        {ready && target && (
          <p className="text-xs text-gray-400">
            {t('SwapQueueModal.afterPrefix')}{courtTitle(source)} {t('SwapQueueModal.queueCount', { n: srcAfter, cap: QUEUE_CAP })} · {courtTitle(target)} {t('SwapQueueModal.queueCount', { n: tgtAfter, cap: QUEUE_CAP })}
          </p>
        )}

        <button
          disabled={!ready || pending}
          onClick={() => {
            if (target) {
              onConfirm({
                courtA: sourceCourtId,
                playersA: [...picksA],
                courtB: target.court_id,
                playersB: [...picksB],
              })
            }
          }}
          className="btn-primary w-full text-sm disabled:opacity-40"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}
