import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { Org, SessionSummary } from '../../api/client'
import { MoreButton, Pill, FilterRow, Select, SearchBox, Stat } from './ui'
import { DAY, PAGE, fmtRange, sessionState, type SessionState } from './format'

// 所有開團:團主 / 狀態 / 期間 / 地區 / 搜尋,可排序,上面一排是篩選後的彙總

type Period = 'all' | 'today' | 'week' | 'month' | 'future'
type SessionSort = 'start' | 'opened' | 'joined' | 'played'

const STATE_STYLE: Record<SessionState, string> = {
  ongoing: 'bg-brand-mint text-emerald-700',
  upcoming: 'bg-brand-lavender/60 text-violet-600',
  closed: 'bg-gray-100 text-gray-400',
}
const STATE_KEY: Record<SessionState, string> = {
  ongoing: 'AdminPage.statusActive',
  upcoming: 'AdminPage.statusNotStarted',
  closed: 'AdminPage.statusEnded',
}

export function SessionsTab({
  orgs,
  sessions,
  now,
  orgFilter,
  setOrgFilter,
  initialState,
}: {
  orgs: Org[] | undefined
  sessions: SessionSummary[]
  now: number
  orgFilter: string
  setOrgFilter: (id: string) => void
  initialState: 'all' | SessionState
}) {
  const { t } = useTranslation()
  const nav = useNavigate()
  const [state, setState] = useState<'all' | SessionState>(initialState)
  const [period, setPeriod] = useState<Period>('all')
  const [city, setCity] = useState('')
  const [dist, setDist] = useState('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SessionSort>('start')
  const [limit, setLimit] = useState(PAGE)

  const orgName = useMemo(() => new Map((orgs ?? []).map((o) => [o.org_id, o.org_name])), [orgs])
  const when = (s: SessionSummary) => new Date(s.start_at || s.opened_at).getTime()

  // 期間以開打時間算(沒填開打時間的老團用開團時間)
  const inPeriod = (s: SessionSummary) => {
    const ts = when(s)
    const startOfToday = new Date(now).setHours(0, 0, 0, 0)
    switch (period) {
      case 'today':
        return ts >= startOfToday && ts < startOfToday + DAY
      case 'week':
        return ts >= now - 7 * DAY && ts <= now + DAY
      case 'month':
        return ts >= now - 30 * DAY && ts <= now + DAY
      case 'future':
        return ts > now
      default:
        return true
    }
  }

  // 狀態以外的條件先套 → 狀態膠囊上的數字跟著其他篩選變
  const base = sessions
    .filter((s) => !orgFilter || s.org_id === orgFilter)
    .filter(inPeriod)
    .filter((s) => !city || s.city === city)
    .filter((s) => !dist || s.district === dist)
    .filter((s) => {
      const k = q.trim().toLowerCase()
      return !k || (s.title || '').toLowerCase().includes(k) || (orgName.get(s.org_id) ?? '').toLowerCase().includes(k)
    })
  const stateCount = (k: 'all' | SessionState) => (k === 'all' ? base.length : base.filter((s) => sessionState(s, now) === k).length)
  const shown = base
    .filter((s) => state === 'all' || sessionState(s, now) === state)
    .sort((a, b) => {
      switch (sort) {
        case 'opened':
          return (b.opened_at || '').localeCompare(a.opened_at || '')
        case 'joined':
          return (b.joined_count ?? 0) - (a.joined_count ?? 0)
        case 'played':
          return (b.played_count ?? 0) - (a.played_count ?? 0)
        default:
          return when(b) - when(a)
      }
    })

  const cityOpts = [...new Set(sessions.map((s) => s.city).filter(Boolean))] as string[]
  const distOpts = [...new Set(sessions.filter((s) => !city || s.city === city).map((s) => s.district).filter(Boolean))] as string[]
  const joined = shown.reduce((n, s) => n + (s.joined_count ?? 0), 0)
  const played = shown.reduce((n, s) => n + (s.played_count ?? 0), 0)
  const playing = shown.reduce((n, s) => n + (s.playing_courts ?? 0), 0)
  const hosts = new Set(shown.map((s) => s.org_id)).size

  return (
    <div className="space-y-3">
      <div className="card space-y-3">
        <span className="font-bold text-gray-700">{t('AdminPage.allSessions')}</span>
        <div className="flex flex-wrap gap-2">
          <SearchBox value={q} onChange={setQ} placeholder={t('AdminPage.sessionSearchPlaceholder')} />
          <Select
            value={orgFilter}
            onChange={setOrgFilter}
            options={[
              { value: '', label: t('AdminPage.allHostsOption') },
              ...(orgs ?? []).filter((o) => o.role !== 'superadmin').map((o) => ({ value: o.org_id, label: o.org_name })),
            ]}
          />
          <Select
            value={city}
            onChange={(v) => {
              setCity(v)
              setDist('')
            }}
            options={[{ value: '', label: t('AdminPage.allCities') }, ...cityOpts.map((c) => ({ value: c, label: c }))]}
          />
          <Select
            value={dist}
            onChange={setDist}
            disabled={distOpts.length === 0}
            options={[{ value: '', label: t('AdminPage.allDistricts') }, ...distOpts.map((d) => ({ value: d, label: d }))]}
          />
          <Select<SessionSort>
            value={sort}
            onChange={setSort}
            options={[
              { value: 'start', label: t('AdminConsole.sortStart') },
              { value: 'opened', label: t('AdminConsole.sortOpened') },
              { value: 'joined', label: t('AdminConsole.sortJoined') },
              { value: 'played', label: t('AdminConsole.sortPlayed') },
            ]}
          />
        </div>
        <FilterRow label={t('AdminConsole.filterStatus')}>
          {(['all', 'ongoing', 'upcoming', 'closed'] as const).map((k) => (
            <Pill key={k} active={state === k} onClick={() => setState(k)} count={stateCount(k)}>
              {k === 'all' ? t('AdminPage.allStatuses') : t(STATE_KEY[k])}
            </Pill>
          ))}
        </FilterRow>
        <FilterRow label={t('AdminConsole.filterPeriod')}>
          {(['all', 'today', 'week', 'month', 'future'] as Period[]).map((k) => (
            <Pill key={k} active={period === k} onClick={() => setPeriod(k)}>
              {t(`AdminConsole.period_${k}`)}
            </Pill>
          ))}
        </FilterRow>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label={t('AdminConsole.statSessions')} value={shown.length} hint={t('AdminConsole.hostsN', { n: hosts })} />
          <Stat label={t('AdminConsole.statAttendance')} value={joined} hint={t('AdminConsole.within90')} />
          <Stat label={t('AdminConsole.statPlayedAttendance')} value={played} />
          <Stat label={t('AdminConsole.statPlayingCourts')} value={playing} />
        </div>
      </div>

      <div className="card space-y-0 p-2 sm:p-3">
        {shown.length === 0 && <p className="text-sm text-gray-300 p-2">{t('AdminPage.noMatchingSessions')}</p>}
        {shown.slice(0, limit).map((s) => {
          const st = sessionState(s, now)
          const quota = s.signup_quota ? `/${s.signup_quota}` : ''
          return (
            <button
              key={s.session_id}
              onClick={() => nav(`/session/${s.session_id}`)}
              className="w-full text-left px-2 py-2.5 border-b border-gray-100 last:border-0 flex items-center gap-3 hover:bg-gray-50 rounded-xl"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-700 truncate flex items-center gap-1.5">
                  <span className="truncate">{s.title || t('AdminPage.untitled')}</span>
                  <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full ${STATE_STYLE[st]}`}>{t(STATE_KEY[st])}</span>
                  {!!s.playing_courts && (
                    <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-brand-pink/15 text-brand-pink font-semibold">
                      {t('AdminPage.playingCourts', { count: s.playing_courts })}
                    </span>
                  )}
                  {s.signup_open && (
                    <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-brand-yellow text-amber-700">
                      {t('AdminConsole.signupOpen')}
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {orgName.get(s.org_id) ?? t('AdminPage.unknown')}
                  {fmtRange(s) && ` · ${fmtRange(s)}`}
                  {s.city && ` · ${s.city}${s.district ?? ''}`}
                  {` · ${t('AdminPage.courtsCount', { count: s.num_courts })}`}
                </p>
              </div>
              {s.joined_count !== undefined && (
                <div className="text-right shrink-0">
                  <p className="text-sm font-extrabold text-gray-700">
                    👥 {s.joined_count}
                    <span className="text-xs font-normal text-gray-400">{quota}</span>
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {t('AdminConsole.playedN', { n: s.played_count ?? 0 })}
                    {!!s.pending_signups && ` · ${t('AdminConsole.pendingN', { n: s.pending_signups })}`}
                  </p>
                </div>
              )}
            </button>
          )
        })}
        <MoreButton shown={Math.min(limit, shown.length)} total={shown.length} onMore={() => setLimit((l) => l + PAGE)} />
      </div>
    </div>
  )
}
