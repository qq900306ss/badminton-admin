import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionPlayer } from '../../api/client'
import { Avatar, Sheet } from './Sheet'

// 點名・收錢:取代團主原本記在 FB/無邊記的報名名單。
// 開團前把報名的名字整串貼進來 → 到場一個個點「到了」、收了錢點「$」→ 散場時沒到的就是爽約。

type Filter = 'all' | 'notHere' | 'unpaid' | 'reserved'

export function RosterTab({
  roster,
  dup,
  onOpen,
  onArrived,
  onPaid,
  onAddOne,
  onPaste,
  busyId,
}: {
  roster: SessionPlayer[] // 已排除報名審核中的人
  dup: Record<string, number>
  onOpen: (p: SessionPlayer) => void
  onArrived: (p: SessionPlayer, arrived: boolean) => void
  onPaid: (p: SessionPlayer, paid: boolean) => void
  onAddOne: (name: string) => void
  onPaste: (names: string[]) => void
  busyId?: string
}) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [newName, setNewName] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')

  const here = roster.filter((p) => p.claimed).length
  const paid = roster.filter((p) => p.paid).length
  const reserved = roster.filter((p) => p.reserved)
  const counts: Record<Filter, number> = {
    all: roster.length,
    notHere: roster.length - here,
    unpaid: roster.filter((p) => p.claimed && !p.paid).length,
    reserved: reserved.length,
  }
  const shown = useMemo(
    () =>
      roster
        .filter((p) =>
          filter === 'notHere' ? !p.claimed : filter === 'unpaid' ? p.claimed && !p.paid : filter === 'reserved' ? p.reserved : true
        )
        .filter((p) => !q.trim() || p.display_name.toLowerCase().includes(q.trim().toLowerCase()))
        // 還沒到的排前面(點名時要找的是他們),同狀態依名字
        .sort((a, b) => Number(a.claimed) - Number(b.claimed) || a.display_name.localeCompare(b.display_name, 'zh-TW')),
    [roster, filter, q]
  )
  // 貼上的內容 → 名字清單:一行一個,去掉編號/符號/空白與重複
  const pasted = useMemo(() => {
    const seen = new Set(roster.map((p) => p.display_name))
    const out: string[] = []
    for (const line of pasteText.split(/\n|,|、/)) {
      const n = line.replace(/^\s*(\d+[.)、. ]|[-*•●・])\s*/, '').trim().slice(0, 20)
      if (n && !seen.has(n)) {
        seen.add(n)
        out.push(n)
      }
    }
    return out
  }, [pasteText, roster])

  return (
    <div className="space-y-3">
      {/* 一眼看:到了幾個、收了幾個 */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: t('Manage.statHere'), value: `${here}/${roster.length}`, tone: 'text-emerald-600' },
          { label: t('Manage.statPaid'), value: `${paid}`, tone: 'text-amber-500' },
          { label: t('Manage.statNoShow'), value: `${reserved.filter((p) => !p.claimed).length}`, tone: 'text-rose-500' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl shadow-sm px-3 py-2.5">
            <div className={`text-xl font-extrabold tabular-nums ${s.tone}`}>{s.value}</div>
            <div className="text-[11px] text-gray-400">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 加人:貼整串報名 / 單筆 */}
      <div className="bg-white rounded-3xl shadow-sm p-3 space-y-2">
        <button
          onClick={() => setPasteOpen(true)}
          className="w-full rounded-2xl border-2 border-dashed border-brand-pink/60 bg-brand-pink/5 py-3 text-sm font-extrabold text-pink-500 active:scale-[0.99]"
        >
          📋 {t('Manage.pasteSignups')}
          <span className="block text-[11px] font-semibold text-gray-400">{t('Manage.pasteSignupsHint')}</span>
        </button>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newName.trim()) {
                onAddOne(newName.trim())
                setNewName('')
              }
            }}
            placeholder={t('Manage.addOnSitePlaceholder')}
            className="flex-1 min-w-0 border-2 border-gray-100 bg-gray-50 rounded-2xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink focus:bg-white"
          />
          <button
            onClick={() => {
              if (!newName.trim()) return
              onAddOne(newName.trim())
              setNewName('')
            }}
            className="px-4 rounded-2xl bg-gray-900 text-white text-sm font-bold disabled:opacity-40"
            disabled={!newName.trim()}
          >
            {t('Manage.add')}
          </button>
        </div>
      </div>

      {/* 篩選 */}
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
        {(['all', 'notHere', 'unpaid', 'reserved'] as Filter[]).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full ${filter === k ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 shadow-sm'}`}
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
          <div key={p.player_id} className={`flex items-center gap-2 pl-3 pr-2 py-2 ${p.claimed ? '' : 'bg-gray-50/60'}`}>
            <button onClick={() => onOpen(p)} className="flex items-center gap-2.5 min-w-0 flex-1 text-left py-0.5">
              <span className={p.claimed ? '' : 'opacity-40 grayscale'}>
                <Avatar p={p} />
              </span>
              <span className="min-w-0">
                <span className={`block text-[15px] font-bold truncate ${p.claimed ? 'text-gray-800' : 'text-gray-400'}`}>
                  {p.display_name}
                  {dup[p.player_id] && <span className="text-[10px] text-gray-400"> #{dup[p.player_id]}</span>}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-gray-400">
                  {p.level > 0 && <span>Lv{p.level}</span>}
                  {p.claimed && <span>· {t('Manage.gamesShort', { n: p.games })}</span>}
                  {p.reserved && <span className="text-sky-500 font-semibold">· {t('Manage.badgeReserved')}</span>}
                  {p.owner_id && <span className="text-violet-500 font-semibold">· 👪 {t('Manage.badgeFamily')}</span>}
                  {p.pending && <span className="text-orange-500 font-semibold">· {t('Manage.badgePending')}</span>}
                </span>
              </span>
            </button>
            <button
              onClick={() => onArrived(p, !p.claimed)}
              disabled={busyId === p.player_id}
              className={`shrink-0 h-9 px-3 rounded-full text-xs font-extrabold transition-colors ${
                p.claimed ? 'bg-emerald-500 text-white' : 'bg-white border-2 border-gray-200 text-gray-400'
              }`}
            >
              {p.claimed ? `✓ ${t('Manage.here')}` : t('Manage.markHere')}
            </button>
            <button
              onClick={() => onPaid(p, !p.paid)}
              disabled={busyId === p.player_id}
              aria-label={t('Manage.paid')}
              className={`shrink-0 w-9 h-9 rounded-full text-sm font-extrabold transition-colors ${
                p.paid ? 'bg-amber-400 text-white' : 'bg-white border-2 border-gray-200 text-gray-300'
              }`}
            >
              $
            </button>
          </div>
        ))}
      </div>

      <Sheet open={pasteOpen} onClose={() => setPasteOpen(false)} title={`📋 ${t('Manage.pasteSignups')}`}>
        <p className="text-xs text-gray-400 mb-2">{t('Manage.pasteHelp')}</p>
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          rows={7}
          autoFocus
          placeholder={'1. 林小姐\n2. Cindy Huang\n3. 王大明 +1'}
          className="w-full border-2 border-gray-100 bg-gray-50 rounded-2xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink focus:bg-white"
        />
        {pasted.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {pasted.map((n) => (
              <span key={n} className="text-xs font-semibold bg-sky-50 text-sky-700 rounded-full px-2.5 py-1">
                {n}
              </span>
            ))}
          </div>
        )}
        <button
          disabled={pasted.length === 0}
          onClick={() => {
            onPaste(pasted)
            setPasteText('')
            setPasteOpen(false)
            setFilter('reserved')
          }}
          className="mt-3 w-full py-3.5 rounded-2xl bg-gray-900 text-white font-extrabold disabled:bg-gray-200 disabled:text-gray-400"
        >
          {t('Manage.addReservedN', { n: pasted.length })}
        </button>
      </Sheet>
    </div>
  )
}
