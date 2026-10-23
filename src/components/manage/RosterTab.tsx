import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionPlayer } from '../../api/client'
import { Avatar } from './Sheet'

// 成員・收錢:這團的人一覽,每人旁邊一個「$」一點切換付了沒;點名字看這個人的操作。

type Filter = 'all' | 'unpaid' | 'paid'

export function RosterTab({
  roster,
  dup,
  onOpen,
  onPaid,
  onAddOne,
  busyId,
}: {
  roster: SessionPlayer[] // 已排除報名審核中的人
  dup: Record<string, number>
  onOpen: (p: SessionPlayer) => void
  onPaid: (p: SessionPlayer, paid: boolean) => void
  onAddOne: (name: string) => void
  busyId?: string
}) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [newName, setNewName] = useState('')

  const paid = roster.filter((p) => p.paid).length
  const counts: Record<Filter, number> = { all: roster.length, unpaid: roster.length - paid, paid }
  const shown = useMemo(
    () =>
      roster
        .filter((p) => (filter === 'unpaid' ? !p.paid : filter === 'paid' ? p.paid : true))
        .filter((p) => !q.trim() || p.display_name.toLowerCase().includes(q.trim().toLowerCase()))
        // 還沒付的排前面(收錢時要找的是他們),同狀態依名字
        .sort((a, b) => Number(a.paid) - Number(b.paid) || a.display_name.localeCompare(b.display_name, 'zh-TW')),
    [roster, filter, q]
  )
  const add = () => {
    if (!newName.trim()) return
    onAddOne(newName.trim())
    setNewName('')
  }

  return (
    <div className="space-y-3">
      {/* 一眼看:幾個人、收了幾個 */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: t('Manage.statPeople'), value: roster.length, tone: 'text-gray-800' },
          { label: t('Manage.statPaid'), value: paid, tone: 'text-amber-500' },
          { label: t('Manage.statUnpaid'), value: roster.length - paid, tone: 'text-rose-500' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl shadow-sm px-3 py-2.5">
            <div className={`text-xl font-extrabold tabular-nums ${s.tone}`}>{s.value}</div>
            <div className="text-[11px] text-gray-400">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 現場加人(沒手機的人) */}
      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder={t('Manage.addOnSitePlaceholder')}
          className="flex-1 min-w-0 border-2 border-gray-100 bg-white rounded-2xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-pink"
        />
        <button onClick={add} disabled={!newName.trim()} className="px-4 rounded-2xl bg-gray-900 text-white text-sm font-bold disabled:opacity-40">
          {t('Manage.add')}
        </button>
      </div>

      {/* 篩選 */}
      <div className="flex gap-1.5">
        {(['all', 'unpaid', 'paid'] as Filter[]).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`text-xs font-bold px-3 py-1.5 rounded-full ${filter === k ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 shadow-sm'}`}
          >
            {t(`Manage.filter_${k}`)} <span className="opacity-60">{counts[k]}</span>
          </button>
        ))}
      </div>
      {roster.length > 8 && (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('Manage.searchName')}
          className="w-full border-2 border-gray-100 bg-white rounded-2xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
        />
      )}

      {/* 名單 */}
      <div className="bg-white rounded-3xl shadow-sm divide-y divide-gray-50 overflow-hidden">
        {shown.length === 0 && <p className="text-sm text-gray-300 p-4 text-center">{t('Manage.nobodyHere')}</p>}
        {shown.map((p) => (
          <div key={p.player_id} className="flex items-center gap-2 pl-3 pr-2 py-2">
            <button onClick={() => onOpen(p)} className="flex items-center gap-2.5 min-w-0 flex-1 text-left py-0.5">
              <Avatar p={p} />
              <span className="min-w-0">
                <span className="block text-[15px] font-bold text-gray-800 truncate">
                  {p.display_name}
                  {dup[p.player_id] && <span className="text-[10px] text-gray-400"> #{dup[p.player_id]}</span>}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-gray-400">
                  {p.level > 0 && <span>Lv{p.level} ·</span>}
                  <span>{t('Manage.gamesShort', { n: p.games })}</span>
                  {p.is_temp && !p.owner_id && <span className="text-sky-500 font-semibold">· {t('Manage.badgeOnSite')}</span>}
                  {p.owner_id && <span className="text-violet-500 font-semibold">· 👪 {t('Manage.badgeFamily')}</span>}
                  {p.pending && <span className="text-orange-500 font-semibold">· {t('Manage.badgePending')}</span>}
                  {!p.claimed && <span className="text-gray-400 font-semibold">· {t('Manage.notHere')}</span>}
                </span>
              </span>
            </button>
            <button
              onClick={() => onPaid(p, !p.paid)}
              disabled={busyId === p.player_id}
              aria-label={p.paid ? t('Manage.paid') : t('Manage.markPaid')}
              className={`shrink-0 h-9 px-3 rounded-full text-xs font-extrabold transition-colors ${
                p.paid ? 'bg-amber-400 text-white' : 'bg-white border-2 border-gray-200 text-gray-400'
              }`}
            >
              {p.paid ? `$ ${t('Manage.paid')}` : `$ ${t('Manage.markPaid')}`}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
