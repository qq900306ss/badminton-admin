import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CourtView, SessionPlayer } from '../../api/client'
import { getTiers } from '../../lib/levels'
import { Avatar, Sheet, SheetAction } from './Sheet'

// 點一個人 → 這個人能做的事(收錢/程度/改名/核准/下場/移除)
export function PlayerSheet({
  player,
  onCourt,
  ownerName,
  onClose,
  onPaid,
  onLevel,
  onRename,
  onApprove,
  onOffCourt,
  onRemove,
}: {
  player: SessionPlayer | null
  onCourt?: { courtTitle: string; playing: boolean } // 他現在在哪個場地(場上或排隊)
  ownerName?: string
  onClose: () => void
  onPaid: (paid: boolean) => void
  onLevel: (lv: number) => void
  onRename: (name: string) => void
  onApprove: () => void
  onOffCourt: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  // 換人時由父層用 key 重新掛載,狀態自然重置
  const [name, setName] = useState(player?.display_name ?? '')
  const [mode, setMode] = useState<'main' | 'level' | 'rename'>('main')
  const p = player
  return (
    <Sheet open={!!p} onClose={onClose}>
      {p && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Avatar p={p} size="lg" />
            <div className="min-w-0">
              <p className="font-extrabold text-gray-800 text-lg truncate">{p.display_name}</p>
              <p className="text-xs text-gray-400">
                {p.level > 0 ? `Lv${p.level}` : t('Manage.noLevel')}
                {' · '}
                {t('Manage.gamesMins', { n: p.games, m: p.total_minutes })}
                {ownerName && ` · 👪 ${t('Manage.familyOf', { name: ownerName })}`}
              </p>
              {onCourt && (
                <p className="text-xs font-bold text-emerald-600">
                  {onCourt.playing ? t('Manage.nowPlayingAt', { court: onCourt.courtTitle }) : t('Manage.nowQueuedAt', { court: onCourt.courtTitle })}
                </p>
              )}
            </div>
          </div>

          {mode === 'main' && (
            <>
              <button
                onClick={() => onPaid(!p.paid)}
                className={`w-full py-3 rounded-2xl font-extrabold text-sm ${p.paid ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-500'}`}
              >
                {p.paid ? `$ ${t('Manage.paid')}` : `$ ${t('Manage.markPaid')}`}
              </button>
              {p.pending && <SheetAction icon="✅" label={t('Manage.approve')} onClick={onApprove} />}
              {onCourt && <SheetAction icon="🪑" label={t('Manage.offCourt')} hint={onCourt.courtTitle} onClick={onOffCourt} />}
              <SheetAction icon="🏷️" label={t('Manage.setLevel')} hint={p.level > 0 ? `Lv${p.level}` : t('Manage.noLevel')} onClick={() => setMode('level')} />
              <SheetAction icon="✏️" label={t('Manage.renameHere')} onClick={() => setMode('rename')} />
              <SheetAction icon="🗑️" label={t('Manage.removeFromSession')} tone="danger" onClick={onRemove} />
            </>
          )}

          {mode === 'level' && (
            <div className="space-y-2">
              {getTiers().map((tier) => (
                <div key={tier.min}>
                  <p className="text-[11px] text-gray-400 font-semibold mb-1">{tier.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: tier.max - tier.min + 1 }, (_, i) => tier.min + i).map((lv) => (
                      <button
                        key={lv}
                        onClick={() => {
                          onLevel(lv)
                          setMode('main')
                        }}
                        className={`w-11 h-11 rounded-xl text-base font-extrabold ${tier.chip} ${p.level === lv ? 'ring-2 ring-gray-900' : ''}`}
                      >
                        {lv}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={() => { onLevel(0); setMode('main') }} className="w-full py-2.5 rounded-2xl bg-gray-100 text-gray-500 text-sm font-bold">
                {t('Manage.clearLevel')}
              </button>
            </div>
          )}

          {mode === 'rename' && (
            <div className="space-y-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                autoFocus
                className="w-full border-2 border-gray-100 bg-gray-50 rounded-2xl px-3 py-3 text-base focus:outline-none focus:border-brand-pink focus:bg-white"
              />
              <button
                disabled={!name.trim() || name.trim() === p.display_name}
                onClick={() => {
                  onRename(name.trim())
                  setMode('main')
                }}
                className="w-full py-3.5 rounded-2xl bg-gray-900 text-white font-extrabold disabled:bg-gray-200 disabled:text-gray-400"
              >
                {t('Manage.save')}
              </button>
            </div>
          )}

        </div>
      )}
    </Sheet>
  )
}

// 把人排上場 / 排隊:場上最少打的排最前面,建議人選標出來;點一下就排
export function AddToCourtSheet({
  target,
  courtTitle,
  candidates,
  onPick,
  onClose,
}: {
  target: { court: CourtView; mode: 'playing' | 'queue' } | null
  courtTitle: string
  candidates: SessionPlayer[] // 已經過濾掉在任何場地上/排隊中的人、待核准的人
  onPick: (p: SessionPlayer) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [q, setQ] = useState('') // 換場地/模式時父層用 key 重新掛載
  const list = candidates
    .filter((p) => !q.trim() || p.display_name.toLowerCase().includes(q.trim().toLowerCase()))
    .slice()
    .sort((a, b) => Number(b.claimed) - Number(a.claimed) || a.games - b.games || a.total_minutes - b.total_minutes)
  const present = list.filter((p) => p.claimed)
  const min = present.length ? Math.min(...present.map((p) => p.games)) : 0
  const max = present.length ? Math.max(...present.map((p) => p.games)) : 0
  return (
    <Sheet
      open={!!target}
      onClose={onClose}
      title={target ? (target.mode === 'playing' ? t('Manage.pickForPlaying', { court: courtTitle }) : t('Manage.pickForQueue', { court: courtTitle })) : ''}
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('Manage.searchName')}
        className="w-full border-2 border-gray-100 bg-gray-50 rounded-2xl px-3 py-2.5 text-sm mb-1 focus:outline-none focus:border-brand-pink focus:bg-white"
      />
      <p className="text-[11px] text-gray-400 mb-2">{t('Manage.fairHint')}</p>
      <div className="space-y-0.5">
        {list.length === 0 && <p className="text-sm text-gray-300 py-4 text-center">{t('Manage.nobodyFree')}</p>}
        {list.map((p) => {
          const suggest = max > min && p.claimed && p.games === min
          return (
            <button
              key={p.player_id}
              onClick={() => onPick(p)}
              className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-2xl text-left active:bg-gray-100 ${suggest ? 'bg-emerald-50' : ''} ${p.claimed ? '' : 'opacity-50'}`}
            >
              <Avatar p={p} size="sm" />
              <span className="font-bold text-gray-700 text-[15px] truncate flex-1">{p.display_name}</span>
              {suggest && <span className="text-[10px] font-extrabold text-emerald-700 bg-white rounded-full px-2 py-0.5">{t('Manage.suggested')}</span>}
              <span className="text-xs text-gray-400 tabular-nums w-14 text-right">
                {p.claimed ? t('Manage.gamesShort', { n: p.games }) : t('Manage.notHere')}
              </span>
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}

// 場地的 ⋯ 選單:不常用的都收在這
export function CourtMenuSheet({
  court,
  title,
  canSwap,
  onClose,
  onRename,
  onToggleLock,
  onSwap,
  onRemove,
}: {
  court: CourtView | null
  title: string
  canSwap: boolean
  onClose: () => void
  onRename: (name: string) => void
  onToggleLock: () => void
  onSwap: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const [renaming, setRenaming] = useState(false) // 換場地時父層用 key 重新掛載
  const [name, setName] = useState(court?.name ?? '')
  return (
    <Sheet open={!!court} onClose={onClose} title={title}>
      {court &&
        (renaming ? (
          <div className="space-y-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('Manage.courtN', { n: court.court_num })}
              autoFocus
              maxLength={12}
              className="w-full border-2 border-gray-100 bg-gray-50 rounded-2xl px-3 py-3 text-base focus:outline-none focus:border-brand-pink focus:bg-white"
            />
            <button
              onClick={() => {
                onRename(name.trim())
                onClose()
              }}
              className="w-full py-3.5 rounded-2xl bg-gray-900 text-white font-extrabold"
            >
              {t('Manage.save')}
            </button>
          </div>
        ) : (
          <div>
            <SheetAction icon="✏️" label={t('Manage.renameCourt')} onClick={() => setRenaming(true)} />
            <SheetAction
              icon={court.locked ? '🔓' : '🔒'}
              label={court.locked ? t('Manage.unlockCourt') : t('Manage.lockCourt')}
              hint={t('Manage.lockHint')}
              onClick={() => {
                onToggleLock()
                onClose()
              }}
            />
            {canSwap && (
              <SheetAction
                icon="⇄"
                label={t('Manage.swapQueue')}
                onClick={() => {
                  onSwap()
                  onClose()
                }}
              />
            )}
            <SheetAction icon="🗑️" label={t('Manage.removeCourt')} tone="danger" onClick={onRemove} />
          </div>
        ))}
    </Sheet>
  )
}
