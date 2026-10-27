import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { adminApi, type AdminPlayer, type Org, type PlayerStats, type SessionSummary } from '../../api/client'
import { ClientBadge } from '../../components/ClientBadge'
import { CLIENT_PLATFORMS, parseClient, platformEmoji, platformName, type ClientPlatform } from '../../lib/clientSource'
import { MoreButton, Pill, FilterRow, Select, SearchBox, Swatch } from './ui'
import { DAY, PROVIDER_LABEL, lastActiveOf, PAGE, ago, fmtDate } from './format'

// 成員管理:依「多久沒來」「有沒有打球」「在誰的團打過」「平台」「登入方式」篩選,
// 列表直接看到最近活動、最近打的團與累積場數;點一下開詳情(打過哪些團、跟誰打)

// 多久沒使用:以「最近使用 App」和「最近加入的團」較晚的那個算;舊帳號兩者都沒有就用註冊時間
type Idle = 'all' | 'd7' | 'd30' | 'd90' | 'over90'
type Play = 'all' | 'played' | 'joinedOnly' | 'none'
type Provider = 'all' | 'google' | 'line' | 'apple'
type MemberSort = 'active' | 'played' | 'idle' | 'created' | 'sessions' | 'games'

const IDLE_RANGE: Record<Exclude<Idle, 'all'>, [number, number]> = {
  d7: [0, 7],
  d30: [7, 30],
  d90: [30, 90],
  over90: [90, Infinity],
}

interface MemberRow {
  p: AdminPlayer
  st?: PlayerStats
  lastActive: string // ISO
}

export function MembersTab({
  players,
  orgs,
  sessions,
  now,
  onOpen,
}: {
  players: AdminPlayer[] | undefined
  orgs: Org[] | undefined
  sessions: SessionSummary[]
  now: number
  onOpen: (playerId: string) => void
}) {
  const { t } = useTranslation()
  const { data: stats, isError: statsErr } = useQuery({
    queryKey: ['admin-player-stats'],
    queryFn: () => adminApi.playerStats().then((r) => r.data.data ?? {}),
    staleTime: 60_000,
  })

  const [q, setQ] = useState('')
  const [idle, setIdle] = useState<Idle>('all')
  const [play, setPlay] = useState<Play>('all')
  const [platform, setPlatform] = useState<ClientPlatform | null>(null)
  const [provider, setProvider] = useState<Provider>('all')
  const [bannedOnly, setBannedOnly] = useState(false)
  const [orgFilter, setOrgFilter] = useState('')
  const [sort, setSort] = useState<MemberSort>('active')
  const [limit, setLimit] = useState(PAGE)

  const sessionById = useMemo(() => new Map(sessions.map((s) => [s.session_id, s])), [sessions])
  const orgName = useMemo(() => new Map((orgs ?? []).map((o) => [o.org_id, o.org_name])), [orgs])

  const rows = useMemo<MemberRow[]>(
    () =>
      (players ?? []).map((p) => {
        const st = stats?.[p.player_id]
        return { p, st, lastActive: lastActiveOf(p, st, now) }
      }),
    [players, stats, now]
  )

  const idleDays = (r: MemberRow) => (now - new Date(r.lastActive).getTime()) / DAY
  const playOf = (r: MemberRow): Exclude<Play, 'all'> =>
    !r.st || r.st.sessions === 0 ? 'none' : r.st.played_in > 0 ? 'played' : 'joinedOnly'

  // 每個維度的條件;算某個維度的膠囊數字時,其他維度照套、自己那維不套
  type Dim = 'idle' | 'play' | 'platform' | 'provider' | 'banned' | 'org' | 'q'
  const tests: Record<Dim, (r: MemberRow) => boolean> = {
    idle: (r) => {
      if (idle === 'all') return true
      const [lo, hi] = IDLE_RANGE[idle]
      const d = idleDays(r)
      return d >= lo && d < hi
    },
    play: (r) => play === 'all' || playOf(r) === play,
    platform: (r) => !platform || parseClient(r.p.last_client).platform === platform,
    provider: (r) => provider === 'all' || (r.p.provider || 'google') === provider,
    banned: (r) => !bannedOnly || !!r.p.banned,
    org: (r) => !orgFilter || !!r.st?.org_ids?.includes(orgFilter),
    q: (r) => {
      const k = q.trim().toLowerCase()
      if (!k) return true
      return [r.p.display_name, r.p.join_name, r.p.email].some((v) => (v || '').toLowerCase().includes(k))
    },
  }
  const passExcept = (r: MemberRow, skip: Dim) => (Object.keys(tests) as Dim[]).every((d) => d === skip || tests[d](r))
  const countBy = <K extends string>(dim: Dim, keys: K[], fn: (r: MemberRow) => K | K[]) => {
    const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>
    for (const r of rows) {
      if (!passExcept(r, dim)) continue
      const v = fn(r)
      for (const k of Array.isArray(v) ? v : [v]) if (k in out) out[k]++
    }
    return out
  }
  const idleCounts = countBy<Idle>('idle', ['all', 'd7', 'd30', 'd90', 'over90'], (r) => {
    const d = idleDays(r)
    const hit = (Object.keys(IDLE_RANGE) as Exclude<Idle, 'all'>[]).find((k) => d >= IDLE_RANGE[k][0] && d < IDLE_RANGE[k][1])
    return hit ? ['all', hit] : ['all']
  })
  const playCounts = countBy<Play>('play', ['all', 'played', 'joinedOnly', 'none'], (r) => ['all', playOf(r)])
  const platformCounts = countBy<ClientPlatform>('platform', CLIENT_PLATFORMS, (r) => parseClient(r.p.last_client).platform)
  const providerCounts = countBy<Provider>('provider', ['all', 'google', 'line', 'apple'], (r) => [
    'all',
    (r.p.provider || 'google') as Provider,
  ])
  const bannedCount = rows.filter((r) => r.p.banned && passExcept(r, 'banned')).length
  const platformTotal = rows.filter((r) => passExcept(r, 'platform')).length

  const shown = rows
    .filter((r) => (Object.values(tests) as ((r: MemberRow) => boolean)[]).every((f) => f(r)))
    .sort((a, b) => {
      switch (sort) {
        case 'played':
          return (b.st?.last_session_at || '').localeCompare(a.st?.last_session_at || '')
        case 'idle':
          return a.lastActive.localeCompare(b.lastActive)
        case 'created':
          return (b.p.created_at || '').localeCompare(a.p.created_at || '')
        case 'sessions':
          return (b.st?.sessions ?? 0) - (a.st?.sessions ?? 0)
        case 'games':
          return (b.st?.games ?? 0) - (a.st?.games ?? 0)
        default:
          return b.lastActive.localeCompare(a.lastActive)
      }
    })

  const orgOptions = (orgs ?? []).filter((o) => o.role !== 'superadmin')
  const anyFilter = idle !== 'all' || play !== 'all' || platform || provider !== 'all' || bannedOnly || orgFilter || q
  const reset = () => {
    setIdle('all')
    setPlay('all')
    setPlatform(null)
    setProvider('all')
    setBannedOnly(false)
    setOrgFilter('')
    setQ('')
  }

  return (
    <div className="space-y-3">
      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-gray-700">{t('AdminPage.allPlayerAccounts')}</span>
          <span className="text-xs text-gray-400">
            {shown.length}/{players?.length ?? 0}
            {anyFilter && (
              <button onClick={reset} className="ml-2 text-brand-pink font-bold">
                {t('AdminConsole.resetFilters')}
              </button>
            )}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <SearchBox value={q} onChange={setQ} placeholder={t('AdminPage.playerSearchPlaceholder')} />
          <Select
            value={orgFilter}
            onChange={setOrgFilter}
            options={[
              { value: '', label: t('AdminConsole.anyHost') },
              ...orgOptions.map((o) => ({ value: o.org_id, label: t('AdminConsole.playedAtHost', { name: o.org_name }) })),
            ]}
          />
          <Select<MemberSort>
            value={sort}
            onChange={setSort}
            options={[
              { value: 'active', label: t('AdminConsole.sortActive') },
              { value: 'played', label: t('AdminConsole.sortLastPlayed') },
              { value: 'idle', label: t('AdminConsole.sortIdle') },
              { value: 'created', label: t('AdminConsole.sortSignup') },
              { value: 'sessions', label: t('AdminConsole.sortMostSessions') },
              { value: 'games', label: t('AdminConsole.sortMostGames') },
            ]}
          />
        </div>

        <FilterRow label={t('AdminConsole.filterIdle')}>
          {(['all', 'd7', 'd30', 'd90', 'over90'] as Idle[]).map((k) => (
            <Pill key={k} active={idle === k} onClick={() => setIdle(k)} count={idleCounts[k]}>
              {t(`AdminConsole.idle_${k}`)}
            </Pill>
          ))}
        </FilterRow>
        <FilterRow label={t('AdminConsole.filterPlay')}>
          {(['all', 'played', 'joinedOnly', 'none'] as Play[]).map((k) => (
            <Pill key={k} active={play === k} onClick={() => setPlay(k)} count={stats ? playCounts[k] : undefined}>
              {t(`AdminConsole.play_${k}`)}
            </Pill>
          ))}
        </FilterRow>
        <FilterRow label={t('AdminConsole.filterPlatform')}>
          <Pill active={platform === null} onClick={() => setPlatform(null)} count={platformTotal}>
            {t('ClientSource.filterAll')}
          </Pill>
          {CLIENT_PLATFORMS.map((pf) => (
            <Pill key={pf} active={platform === pf} onClick={() => setPlatform(platform === pf ? null : pf)} count={platformCounts[pf]}>
              {platformEmoji(pf)} {platformName(pf, t)}
            </Pill>
          ))}
        </FilterRow>
        <FilterRow label={t('AdminConsole.filterLogin')}>
          {(['all', 'google', 'line', 'apple'] as Provider[]).map((k) => (
            <Pill key={k} active={provider === k} onClick={() => setProvider(k)} count={providerCounts[k]}>
              {k === 'all' ? t('AdminConsole.all') : PROVIDER_LABEL[k]}
            </Pill>
          ))}
          <Pill active={bannedOnly} onClick={() => setBannedOnly((v) => !v)} count={bannedCount}>
            🚫 {t('AdminPage.bannedBadge')}
          </Pill>
        </FilterRow>
        <p className="text-[11px] text-gray-400">
          {t('AdminConsole.idleHint')}
          {statsErr && <span className="text-red-400"> · {t('AdminConsole.statsFailed')}</span>}
        </p>
      </div>

      <div className="card p-2 sm:p-3">
        {!players && <p className="text-sm text-gray-300 p-2">{t('AdminPage.loading')}</p>}
        {players && shown.length === 0 && <p className="text-sm text-gray-300 p-2">{t('AdminPage.noPlayersFound')}</p>}
        {shown.slice(0, limit).map((r) => {
          const { p, st } = r
          const last = st?.last_session_id ? sessionById.get(st.last_session_id) : undefined
          const name = p.join_name || p.display_name || t('AdminPage.noName')
          return (
            <button
              key={p.player_id}
              onClick={() => onOpen(p.player_id)}
              className="w-full text-left px-2 py-2.5 border-b border-gray-100 last:border-0 flex items-center gap-3 hover:bg-gray-50 rounded-xl"
            >
              <Swatch url={p.avatar_url || p.photo_url} fallback={name[0]} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 min-w-0">
                  <span className="truncate">{name}</span>
                  {p.join_name && p.display_name && p.join_name !== p.display_name && (
                    <span className="text-[11px] font-normal text-gray-400 truncate">({p.display_name})</span>
                  )}
                  {p.banned && (
                    <span className="shrink-0 text-[10px] bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full">{t('AdminPage.bannedBadge')}</span>
                  )}
                </p>
                <p className="text-[11px] text-gray-400 truncate">
                  {last || st?.last_session_at
                    ? t('AdminConsole.lastPlayedAt', {
                        title: last?.title || t('AdminPage.untitled'),
                        host: last ? (orgName.get(last.org_id) ?? '') : '',
                        when: ago(st?.last_session_at, now, t),
                      })
                    : t('AdminConsole.neverJoined', { date: fmtDate(p.created_at) })}
                </p>
              </div>
              <div className="shrink-0 text-right hidden sm:block">
                {st && st.sessions > 0 ? (
                  <p className="text-xs font-bold text-gray-600">{t('AdminConsole.sessionsGames', { s: st.sessions, g: st.games })}</p>
                ) : (
                  <p className="text-xs text-gray-300">—</p>
                )}
                <p className="text-[10px] text-gray-400">{t('AdminConsole.activeAgo', { when: ago(r.lastActive, now, t) })}</p>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-0.5">
                <ClientBadge client={p.last_client} />
                <span className="text-[10px] text-gray-400 sm:hidden">{ago(r.lastActive, now, t)}</span>
              </div>
            </button>
          )
        })}
        <MoreButton shown={Math.min(limit, shown.length)} total={shown.length} onMore={() => setLimit((l) => l + PAGE)} />
      </div>
    </div>
  )
}
