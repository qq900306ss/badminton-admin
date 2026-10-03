import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi, type SessionSummary, type AdminPlayer, type Report, type ReportReason } from '../api/client'
import { useConfirm } from '../components/Confirm'
import { isPhotoUrl } from '../lib/avatar'
import { ClientBadge } from '../components/ClientBadge'
import { CLIENT_PLATFORMS, parseClient, platformEmoji, platformName, type ClientPlatform } from '../lib/clientSource'

function fmtRange(s: SessionSummary): string {
  if (!s.start_at) return ''
  const start = new Date(s.start_at)
  const hm = (d: Date) =>
    d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
  const day = `${start.getMonth() + 1}/${start.getDate()}`
  const tail = s.end_at ? `–${hm(new Date(s.end_at))}` : ''
  return `${day} ${hm(start)}${tail}`
}

// 列表時間:月/日 時:分(意見回饋、檢舉共用)
const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

type Tab = 'orgs' | 'sessions' | 'members' | 'reports' | 'feedback'

const REASON_KEY: Record<ReportReason, string> = {
  inappropriate: 'AdminPage.reasonInappropriate',
  harassment: 'AdminPage.reasonHarassment',
  spam: 'AdminPage.reasonSpam',
  other: 'AdminPage.reasonOther',
  blocked: 'AdminPage.reasonBlocked',
}

// avatar swatch: photo URL → <img>, emoji string → glyph, else first letter
function Swatch({ url, fallback }: { url?: string; fallback: string }) {
  if (isPhotoUrl(url)) return <img src={url} alt="" className="w-10 h-10 rounded-full object-cover" />
  return (
    <span className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg">
      {url || fallback}
    </span>
  )
}

// 停權 / 解除停權(成員列表與檢舉共用);停權由呼叫端先確認
function BanToggle({
  banned,
  pending,
  boxed,
  onBan,
  onUnban,
}: {
  banned: boolean
  pending: boolean
  boxed?: boolean
  onBan: () => void
  onUnban: () => void
}) {
  const { t } = useTranslation()
  return (
    <button
      onClick={banned ? onUnban : onBan}
      disabled={pending}
      className={`text-xs font-bold shrink-0 disabled:opacity-50 ${
        boxed ? 'px-3 py-1.5 rounded-2xl border-2' : ''
      } ${banned ? 'text-emerald-600 border-emerald-200' : 'text-red-500 border-red-200'}`}
    >
      {banned ? t('AdminPage.unban') : t('AdminPage.ban')}
    </button>
  )
}

export function AdminPage() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const qc = useQueryClient()
  const confirm = useConfirm()

  const [tab, setTab] = useState<Tab>('orgs')
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null) // filter sessions by leader
  // 狀態三分:進行中(open 且開打時間已到)/ 尚未開始(open 但還沒到)/ 已結束
  const [statusFilter, setStatusFilter] = useState<'all' | 'ongoing' | 'upcoming' | 'closed'>('all')
  // 現在時刻放 state(render 保持純),每分鐘更新 → 時間到自動變進行中
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])
  const [citySel, setCitySel] = useState('')
  const [distSel, setDistSel] = useState('')
  const [sessionSearch, setSessionSearch] = useState('')
  const [playerSearch, setPlayerSearch] = useState('')
  const [email, setEmail] = useState('')
  const [orgName, setOrgName] = useState('')
  const [error, setError] = useState('')
  const [reportFilter, setReportFilter] = useState<'open' | 'all'>('open')
  const [platformFilter, setPlatformFilter] = useState<ClientPlatform | null>(null) // 會員管理:只看某個來源平台
  const [notes, setNotes] = useState<Record<string, string>>({}) // 檢舉 id → 處理備註草稿

  const { data: orgs } = useQuery({
    queryKey: ['orgs'],
    queryFn: () => adminApi.listOrgs().then((r) => r.data.data),
  })
  const { data: allSessions } = useQuery({
    queryKey: ['admin-sessions'],
    queryFn: () => adminApi.listSessions().then((r) => r.data.data),
    refetchInterval: 15000, // superadmin dashboard (no WS here) — 15s is plenty
  })
  const { data: feedback } = useQuery({
    queryKey: ['admin-feedback'],
    queryFn: () => adminApi.listFeedback().then((r) => r.data.data),
  })
  const { data: players } = useQuery({
    queryKey: ['admin-players'],
    queryFn: () => adminApi.listPlayers().then((r) => r.data.data),
    enabled: tab === 'members' || tab === 'reports', // only scan when needed(檢舉要看停權狀態)
    refetchInterval: tab === 'reports' ? 60000 : false, // 跟待處理檢舉同步對帳,新帳號被檢舉才拿得到處理鈕
  })
  // 待處理檢舉:導覽 badge 也靠它 → 一直拉、每分鐘對帳(承諾 24 小時內處理)
  const { data: openReports, isError: openReportsErr } = useQuery({
    queryKey: ['admin-reports', 'open'],
    queryFn: () => adminApi.listReports('open').then((r) => r.data.data ?? []),
    refetchInterval: 60000,
  })
  const { data: allReports, isError: allReportsErr } = useQuery({
    queryKey: ['admin-reports', 'all'],
    queryFn: () => adminApi.listReports('all').then((r) => r.data.data ?? []),
    enabled: tab === 'reports' && reportFilter === 'all',
  })
  const reports = reportFilter === 'all' ? allReports : openReports
  const reportsErr = reportFilter === 'all' ? allReportsErr : openReportsErr
  const openReportCount = openReports?.length ?? 0

  const playerById = new Map((players ?? []).map((p) => [p.player_id, p]))
  const orgNameOf = (id: string) => (orgs ?? []).find((o) => o.org_id === id)?.org_name ?? t('AdminPage.unknown')
  const leaderCount = (orgs ?? []).filter((o) => o.role === 'leader').length
  // 團主列表依建立時間排序(最新在上)
  const shownOrgs = (orgs ?? [])
    .slice()
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  const sessions = (allSessions ?? [])
    .slice()
    .sort((a, b) => (b.opened_at || '').localeCompare(a.opened_at || ''))
  // 尚未開始 = open 但開打時間還沒到;進行中 = open 且已到時段
  const notStarted = (s: SessionSummary) =>
    s.status === 'open' && !!s.start_at && new Date(s.start_at).getTime() > now
  const sessionState = (s: SessionSummary): 'ongoing' | 'upcoming' | 'closed' =>
    s.status !== 'open' ? 'closed' : notStarted(s) ? 'upcoming' : 'ongoing'
  const openCount = sessions.filter((s) => sessionState(s) === 'ongoing').length
  // 每個團主開過幾團(團主管理列表顯示用)
  const sessionCountByOrg = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.org_id] = (acc[s.org_id] ?? 0) + 1
    return acc
  }, {})
  // 縣市 / 區 選項從實際開團資料推導(只列有開團的地區)
  const cityOpts = [...new Set(sessions.map((s) => s.city).filter(Boolean))] as string[]
  const distOpts = [
    ...new Set(sessions.filter((s) => !citySel || s.city === citySel).map((s) => s.district).filter(Boolean)),
  ] as string[]
  const shownSessions = sessions
    .filter((s) => (selectedOrg ? s.org_id === selectedOrg : true))
    .filter((s) => (statusFilter === 'all' ? true : sessionState(s) === statusFilter))
    .filter((s) => (citySel ? s.city === citySel : true))
    .filter((s) => (distSel ? s.district === distSel : true))
    .filter((s) => {
      const q = sessionSearch.trim()
      if (!q) return true
      return (s.title || '').includes(q) || orgNameOf(s.org_id).includes(q)
    })
  // 各來源平台的人數(依最近使用的平台算,不受搜尋/篩選影響)
  const platformCounts = (players ?? []).reduce(
    (acc, p) => {
      acc[parseClient(p.last_client).platform]++
      return acc
    },
    { ios: 0, android: 0, pwa: 0, web: 0, unknown: 0 } as Record<ClientPlatform, number>
  )
  const shownPlayers = (players ?? [])
    .filter((p) => !platformFilter || parseClient(p.last_client).platform === platformFilter)
    .filter((p) => {
      const q = playerSearch.trim()
      if (!q) return true
      return (
        (p.display_name || '').includes(q) ||
        (p.join_name || '').includes(q) ||
        (p.email || '').includes(q)
      )
    })
    // 依加入時間排序,最新的在最上面
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  // jump from a stat card straight to the relevant view
  const goSessions = (status: 'all' | 'ongoing') => {
    setSelectedOrg(null)
    setStatusFilter(status)
    setSessionSearch('')
    setTab('sessions')
  }

  const invalidate = () => qc.invalidateQueries({ queryKey: ['orgs'] })
  const create = useMutation({
    mutationFn: () => adminApi.createOrg(email, orgName),
    onSuccess: () => {
      invalidate()
      setEmail('')
      setOrgName('')
      setError('')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? t('AdminPage.addHostFailed'))
    },
  })
  const remove = useMutation({
    mutationFn: (orgId: string) => adminApi.deleteOrg(orgId),
    onSuccess: invalidate,
  })
  const renameOrg = useMutation({
    mutationFn: (v: { orgId: string; name: string }) => adminApi.renameOrg(v.orgId, v.name),
    onSuccess: invalidate,
  })
  // 這幾個動作沒有表單可放錯誤 → 直接把後端訊息 alert 出來
  const alertErr = (e: unknown) => {
    const m = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
    alert(m ?? t('AdminPage.actionFailed'))
  }
  const toggleDisabled = useMutation({
    mutationFn: (v: { orgId: string; disabled: boolean }) => adminApi.setDisabled(v.orgId, v.disabled),
    onSuccess: invalidate,
    onError: alertErr,
  })
  const setBanned = useMutation({
    mutationFn: (v: { playerId: string; banned: boolean }) => adminApi.setPlayerBanned(v.playerId, v.banned),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-players'] }),
    onError: alertErr,
  })
  const resetProfile = useMutation({
    mutationFn: (playerId: string) => adminApi.resetPlayerProfile(playerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-players'] }),
    onError: alertErr,
  })
  const resolveReport = useMutation({
    mutationFn: (v: { id: string; note: string }) => adminApi.resolveReport(v.id, v.note),
    onSuccess: (_r, v) => {
      setNotes((n) => {
        const next = { ...n }
        delete next[v.id]
        return next
      })
      qc.invalidateQueries({ queryKey: ['admin-reports'] })
    },
    onError: alertErr,
  })

  // 破壞性動作都先確認;解除停權 / 重新啟用不用
  async function banPlayer(p: { player_id: string; name: string }) {
    if (await confirm({ message: t('AdminPage.banConfirm', { name: p.name }), confirmText: t('AdminPage.ban'), danger: true })) {
      setBanned.mutate({ playerId: p.player_id, banned: true })
    }
  }
  async function disableHost(orgId: string) {
    if (await confirm({ message: t('AdminPage.disableHostConfirm', { name: orgNameOf(orgId) }), confirmText: t('AdminPage.disableHost'), danger: true })) {
      toggleDisabled.mutate({ orgId, disabled: true })
    }
  }

  async function impersonate(orgId: string) {
    try {
      const res = await adminApi.impersonate(orgId)
      localStorage.setItem('admin_token', localStorage.getItem('token') || '')
      localStorage.setItem('admin_org', localStorage.getItem('org') || '')
      localStorage.setItem('token', res.data.data.token)
      localStorage.setItem('org', JSON.stringify(res.data.data.org))
      nav('/')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? t('AdminPage.switchIdentityFailed'))
    }
  }

  const NAV: { key: Tab; label: string; badge?: number }[] = [
    { key: 'orgs', label: t('AdminPage.navHosts') },
    { key: 'sessions', label: t('AdminPage.navSessions') },
    { key: 'members', label: t('AdminPage.navMembers') },
    { key: 'reports', label: t('AdminPage.navReports'), badge: openReportCount },
    { key: 'feedback', label: `${t('AdminPage.navFeedback')}${feedback?.length ? ` (${feedback.length})` : ''}` },
  ]

  return (
    <div className="min-h-screen bg-brand-bg pb-10">
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        {/* 一律回「上一頁」(瀏覽歷史),不是硬跳前台;沒有上一頁才 fallback 回前台 */}
        <button
          onClick={() => ((window.history.state?.idx ?? 0) > 0 ? nav(-1) : nav('/'))}
          className="text-sm text-gray-400"
        >
          {t('AdminPage.back')}
        </button>
        <span className="font-extrabold text-gray-800">{t('AdminPage.superAdmin')}</span>
        <span className="w-12" />
      </header>

      <div className="max-w-5xl mx-auto p-4 md:flex md:gap-4 md:items-start">
        {/* left nav (horizontal scroll on mobile, vertical list on desktop) */}
        <nav className="flex md:flex-col gap-1 overflow-x-auto md:w-48 md:shrink-0 mb-3 md:mb-0">
          {NAV.map((n) => (
            <button
              key={n.key}
              onClick={() => setTab(n.key)}
              className={`px-3 py-2 rounded-2xl text-sm font-bold whitespace-nowrap text-left ${
                tab === n.key ? 'bg-brand-pink text-white' : 'bg-white text-gray-500'
              }`}
            >
              {n.label}
              {!!n.badge && (
                <span className="ml-1.5 inline-block min-w-[1.25rem] text-center bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {n.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="flex-1 min-w-0 space-y-4">
          {/* stats — clickable, jump to the relevant view */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t('AdminPage.statHosts'), value: leaderCount, emoji: '🧑‍🏫', onClick: () => setTab('orgs') },
              { label: t('AdminPage.statActive'), value: openCount, emoji: '🏸', onClick: () => goSessions('ongoing') },
              { label: t('AdminPage.statTotalSessions'), value: sessions.length, emoji: '📋', onClick: () => goSessions('all') },
            ].map((stat) => (
              <button
                key={stat.label}
                onClick={stat.onClick}
                className="card text-center py-3 active:scale-95 transition-transform hover:ring-2 hover:ring-brand-pink/40"
              >
                <div className="text-2xl">{stat.emoji}</div>
                <div className="text-2xl font-extrabold text-gray-800">{stat.value}</div>
                <div className="text-xs text-gray-400">{stat.label} ›</div>
              </button>
            ))}
          </div>

          {/* === 團主管理 === */}
          {tab === 'orgs' && (
            <>
              <div className="card space-y-3">
                <span className="font-bold text-gray-700">{t('AdminPage.addHost')}</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('AdminPage.hostEmailPlaceholder')}
                  className="w-full border-2 border-gray-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-pink"
                />
                <input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder={t('AdminPage.groupNamePlaceholder')}
                  className="w-full border-2 border-gray-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-pink"
                />
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <button
                  onClick={() => create.mutate()}
                  disabled={!email.trim() || !orgName.trim() || create.isPending}
                  className="btn-primary w-full text-sm disabled:opacity-50"
                >
                  {t('AdminPage.addHost')}
                </button>
              </div>

              <div className="card space-y-2">
                <span className="font-bold text-gray-700">{t('AdminPage.allHostsTitle')}</span>
                {shownOrgs.map((o) => (
                  <div key={o.org_id} className="flex items-center justify-between py-2 border-b last:border-0 gap-2">
                    <button
                      onClick={() => {
                        setSelectedOrg(o.org_id)
                        setTab('sessions')
                      }}
                      className="min-w-0 text-left flex-1"
                    >
                      <p className="font-semibold text-gray-700 truncate">
                        {o.org_name}
                        {o.role === 'superadmin' && (
                          <span className="ml-2 text-xs bg-brand-yellow text-amber-700 px-2 py-0.5 rounded-full">{t('AdminPage.adminBadge')}</span>
                        )}
                        {o.disabled && (
                          <span className="ml-2 text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full">{t('AdminPage.disabledBadge')}</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {o.google_email}
                        {/* 這位團主開過幾團(從已載入的所有開團算,不另打 API) */}
                        {(sessionCountByOrg[o.org_id] ?? 0) > 0 && (
                          <span> · {t('AdminPage.orgSessionCount', { n: sessionCountByOrg[o.org_id] })}</span>
                        )}
                      </p>
                    </button>
                    {o.role !== 'superadmin' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            const n = window.prompt(t('AdminPage.newGroupNamePrompt'), o.org_name)?.trim()
                            if (n) renameOrg.mutate({ orgId: o.org_id, name: n })
                          }}
                          className="text-xs font-semibold text-gray-500"
                        >
                          {t('AdminPage.rename')}
                        </button>
                        <button onClick={() => impersonate(o.org_id)} className="text-xs font-semibold text-brand-pink">
                          {t('AdminPage.impersonate')}
                        </button>
                        <button
                          onClick={() => toggleDisabled.mutate({ orgId: o.org_id, disabled: !o.disabled })}
                          className={`text-xs font-semibold ${o.disabled ? 'text-emerald-500' : 'text-amber-500'}`}
                        >
                          {o.disabled ? t('AdminPage.enable') : t('AdminPage.disable')}
                        </button>
                        <button
                          onClick={async () => {
                            if (await confirm({ message: t('AdminPage.deleteHostConfirm', { name: o.org_name }), confirmText: t('AdminPage.delete'), danger: true })) {
                              remove.mutate(o.org_id)
                            }
                          }}
                          className="text-red-300 text-xs"
                        >
                          {t('AdminPage.delete')}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* === 所有開團 === */}
          {tab === 'sessions' && (
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-700">{t('AdminPage.allSessions')}</span>
                <span className="text-xs text-gray-400">{t('AdminPage.entryCount', { count: shownSessions.length })}</span>
              </div>
              {/* filters: 團主 + 狀態 + 搜尋 */}
              <div className="flex flex-wrap gap-2">
                <select
                  value={selectedOrg ?? ''}
                  onChange={(e) => setSelectedOrg(e.target.value || null)}
                  className="border-2 border-gray-200 rounded-2xl px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-brand-pink"
                >
                  <option value="">{t('AdminPage.allHostsOption')}</option>
                  {(orgs ?? [])
                    .filter((o) => o.role !== 'superadmin')
                    .map((o) => (
                      <option key={o.org_id} value={o.org_id}>{o.org_name}</option>
                    ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | 'ongoing' | 'upcoming' | 'closed')}
                  className="border-2 border-gray-200 rounded-2xl px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-brand-pink"
                >
                  <option value="all">{t('AdminPage.allStatuses')}</option>
                  <option value="ongoing">{t('AdminPage.statusActive')}</option>
                  <option value="upcoming">{t('AdminPage.statusNotStarted')}</option>
                  <option value="closed">{t('AdminPage.statusEnded')}</option>
                </select>
                <select
                  value={citySel}
                  onChange={(e) => { setCitySel(e.target.value); setDistSel('') }}
                  className="border-2 border-gray-200 rounded-2xl px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-brand-pink"
                >
                  <option value="">{t('AdminPage.allCities')}</option>
                  {cityOpts.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  value={distSel}
                  onChange={(e) => setDistSel(e.target.value)}
                  disabled={distOpts.length === 0}
                  className="border-2 border-gray-200 rounded-2xl px-3 py-1.5 text-sm bg-white disabled:opacity-40 focus:outline-none focus:border-brand-pink"
                >
                  <option value="">{t('AdminPage.allDistricts')}</option>
                  {distOpts.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <input
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  placeholder={t('AdminPage.sessionSearchPlaceholder')}
                  className="flex-1 min-w-[8rem] border-2 border-gray-200 rounded-2xl px-3 py-1.5 text-sm focus:outline-none focus:border-brand-pink"
                />
              </div>
              {shownSessions.length === 0 && <p className="text-sm text-gray-300">{t('AdminPage.noMatchingSessions')}</p>}
              {shownSessions.map((s) => (
                <button
                  key={s.session_id}
                  onClick={() => nav(`/session/${s.session_id}`)}
                  className="w-full text-left py-2 border-b last:border-0 flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-700 truncate">
                      {s.title || t('AdminPage.untitled')}
                      {(() => {
                        const state = sessionState(s)
                        return (
                          <span
                            className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                              state === 'ongoing'
                                ? 'bg-brand-mint text-emerald-700'
                                : state === 'upcoming'
                                  ? 'bg-brand-lavender/60 text-violet-600'
                                  : 'bg-gray-100 text-gray-400'
                            }`}
                          >
                            {state === 'ongoing'
                              ? t('AdminPage.statusActive')
                              : state === 'upcoming'
                                ? t('AdminPage.statusNotStarted')
                                : t('AdminPage.statusEnded')}
                          </span>
                        )
                      })()}
                      {!!s.playing_courts && (
                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-brand-pink/15 text-brand-pink font-semibold">
                          {t('AdminPage.playingCourts', { count: s.playing_courts })}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {orgNameOf(s.org_id)}
                      {fmtRange(s) && <span> · {fmtRange(s)}</span>} · {t('AdminPage.courtsCount', { count: s.num_courts })}
                      {/* 人數(全部成員/實際打過)— 已結束的名單保留 ~90 天,期限內也統計得到 */}
                      {s.joined_count !== undefined && (
                        <span> · {t('AdminPage.memberCounts', { total: s.joined_count, played: s.played_count ?? 0 })}</span>
                      )}
                    </p>
                  </div>
                  <span className="text-brand-pink text-sm font-semibold shrink-0">{t('AdminPage.view')}</span>
                </button>
              ))}
            </div>
          )}

          {/* === 成員管理 === */}
          {tab === 'members' && (
            <div className="card space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-700">{t('AdminPage.allPlayerAccounts')}</span>
                <span className="text-xs text-gray-400">{shownPlayers.length}/{players?.length ?? 0}</span>
              </div>
              <input
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                placeholder={t('AdminPage.playerSearchPlaceholder')}
                className="w-full border-2 border-gray-200 rounded-2xl px-3 py-1.5 text-sm focus:outline-none focus:border-brand-pink"
              />
              {/* 來源平台統計(點一下只看那個平台,再點一次取消) */}
              {players && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setPlatformFilter(null)}
                    className={`text-xs font-bold px-3 py-1 rounded-full ${
                      platformFilter === null ? 'bg-brand-pink text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {t('ClientSource.filterAll')} {players.length}
                  </button>
                  {CLIENT_PLATFORMS.map((pf) => (
                    <button
                      key={pf}
                      onClick={() => setPlatformFilter(platformFilter === pf ? null : pf)}
                      className={`text-xs font-bold px-3 py-1 rounded-full ${
                        platformFilter === pf ? 'bg-brand-pink text-white' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {platformEmoji(pf)} {platformName(pf, t)} {platformCounts[pf]}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-gray-400">{t('AdminPage.identityHint')}</p>
              {!players && <p className="text-sm text-gray-300">{t('AdminPage.loading')}</p>}
              {players && shownPlayers.length === 0 && <p className="text-sm text-gray-300">{t('AdminPage.noPlayersFound')}</p>}
              {shownPlayers.map((p: AdminPlayer) => (
                <div key={p.player_id} className="py-2 border-b last:border-0 flex items-center gap-3">
                  {/* login identity */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Swatch url={p.photo_url} fallback={(p.display_name || '?')[0]} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-700 truncate">{p.display_name || t('AdminPage.noName')}</p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {p.provider === 'line' ? 'LINE' : p.provider === 'apple' ? 'Apple' : 'Google'}
                        {p.email ? ` · ${p.email}` : ''}
                      </p>
                    </div>
                  </div>
                  <span className="text-gray-300 shrink-0">→</span>
                  {/* current identity */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Swatch url={p.avatar_url} fallback={(p.join_name || p.display_name || '?')[0]} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 min-w-0">
                        <span className="truncate">{p.join_name || p.display_name || t('AdminPage.noName')}</span>
                        {p.banned && (
                          <span className="shrink-0 text-[10px] bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full">{t('AdminPage.bannedBadge')}</span>
                        )}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {p.default_level ? t('AdminPage.defaultLevel', { level: p.default_level }) : t('AdminPage.noLevelSet')}
                      </p>
                    </div>
                  </div>
                  {/* 來源:最近使用的平台 + 時間;註冊時的平台不一樣才另外標 */}
                  <div className="shrink-0 flex flex-col items-end gap-0.5 max-w-[9rem]">
                    <ClientBadge client={p.last_client} />
                    {p.last_seen_at && (
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        {t('ClientSource.lastSeen', { when: fmtWhen(p.last_seen_at) })}
                      </span>
                    )}
                    {p.signup_client && parseClient(p.signup_client).platform !== parseClient(p.last_client).platform && (
                      <span className="text-[10px] text-gray-300 whitespace-nowrap">
                        {t('ClientSource.signupFrom', { platform: platformName(parseClient(p.signup_client).platform, t) })}
                      </span>
                    )}
                  </div>
                  <BanToggle
                    banned={!!p.banned}
                    pending={setBanned.isPending && setBanned.variables?.playerId === p.player_id}
                    onBan={() => banPlayer({ player_id: p.player_id, name: p.join_name || p.display_name })}
                    onUnban={() => setBanned.mutate({ playerId: p.player_id, banned: false })}
                  />
                </div>
              ))}
            </div>
          )}

          {/* === 檢舉 === */}
          {tab === 'reports' && (
            <div className="card space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-gray-700">{t('AdminPage.reportsTitle')}</span>
                <div className="flex gap-1">
                  {(['open', 'all'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setReportFilter(f)}
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        reportFilter === f ? 'bg-brand-pink text-white' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {f === 'open' ? t('AdminPage.reportsOpen', { count: openReportCount }) : t('AdminPage.reportsAll')}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-gray-400">{t('AdminPage.reportsHint')}</p>
              {reportsErr && <p className="text-sm text-red-400">{t('AdminPage.reportsLoadFailed')}</p>}
              {!reports && !reportsErr && <p className="text-sm text-gray-300">{t('AdminPage.loading')}</p>}
              {reports && reports.length === 0 && (
                <p className="text-sm text-gray-300">
                  {reportFilter === 'open' ? t('AdminPage.noOpenReports') : t('AdminPage.noReports')}
                </p>
              )}
              {(reports ?? []).map((r: Report) => {
                const acctId = r.target_account_id
                const acct = acctId ? playerById.get(acctId) : undefined
                const org = (orgs ?? []).find((o) => o.org_id === r.target_org_id)
                // 處理對象:有帳號的球友 → 清除/停權;團主手動加的名字或開團內容 → 停用團主
                const hostIsTarget = r.target_type === 'session' || !acctId
                return (
                  <div key={r.id} className="py-3 border-b last:border-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          r.reason === 'blocked' ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-500'
                        }`}
                      >
                        {t(REASON_KEY[r.reason] ?? 'AdminPage.reasonOther')}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-lavender/60 text-violet-600">
                        {r.target_type === 'player' ? t('AdminPage.targetPlayer') : t('AdminPage.targetSession')}
                      </span>
                      {r.status === 'resolved' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-mint text-emerald-700">
                          {t('AdminPage.resolvedBadge')}
                        </span>
                      )}
                      <ClientBadge client={r.client} hideUnknown />
                      <span className="text-[11px] text-gray-300 ml-auto">{fmtWhen(r.created_at)}</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {t('AdminPage.reporter', { name: r.reporter_name || t('AdminPage.anonymous') })}
                    </p>
                    {r.detail && <p className="text-sm text-gray-600 whitespace-pre-wrap">{r.detail}</p>}

                    {/* 內容快照(檢舉當下的原文,之後被改掉也看得到) */}
                    <div className="bg-gray-50 rounded-2xl p-3 space-y-1.5">
                      <p className="text-[11px] font-bold text-gray-400">{t('AdminPage.snapshotTitle')}</p>
                      {r.target_type === 'player' ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <Swatch url={r.target_avatar_url} fallback={(r.target_name || '?')[0]} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-700 break-all">
                              {r.target_name || t('AdminPage.noName')}
                              {acct?.banned && (
                                <span className="ml-2 text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full">{t('AdminPage.bannedBadge')}</span>
                              )}
                            </p>
                            {!acctId && <p className="text-[11px] text-amber-600">{t('AdminPage.hostCreatedName')}</p>}
                            {acctId && players && !acct && <p className="text-[11px] text-gray-400">{t('AdminPage.accountGone')}</p>}
                          </div>
                        </div>
                      ) : (
                        ([
                          ['snapTitle', r.session_title],
                          ['snapDescription', r.session_description],
                          ['snapAnnouncement', r.session_announcement],
                        ] as const).map(([k, v]) => (
                          <div key={k}>
                            <p className="text-[11px] text-gray-400">{t(`AdminPage.${k}`)}</p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{v || t('AdminPage.snapEmpty')}</p>
                          </div>
                        ))
                      )}
                      <button onClick={() => nav(`/session/${r.session_id}`)} className="text-[11px] text-left text-gray-400">
                        {t('AdminPage.inSession', { title: r.session_title || t('AdminPage.untitled'), org: orgNameOf(r.target_org_id) })}
                        <span className="text-brand-pink font-semibold"> {t('AdminPage.view')}</span>
                      </button>
                    </div>

                    {/* 處理動作 */}
                    <div className="flex flex-wrap items-center gap-2">
                      {!hostIsTarget && acct && (
                        <>
                          <button
                            onClick={async () => {
                              const name = r.target_name || acct.join_name || acct.display_name
                              if (await confirm({ message: t('AdminPage.resetProfileConfirm', { name }), confirmText: t('AdminPage.resetProfile'), danger: true })) {
                                resetProfile.mutate(acct.player_id)
                              }
                            }}
                            disabled={resetProfile.isPending && resetProfile.variables === acct.player_id}
                            className="text-xs font-bold px-3 py-1.5 rounded-2xl border-2 border-amber-200 text-amber-600 disabled:opacity-50"
                          >
                            {resetProfile.isSuccess && resetProfile.variables === acct.player_id ? t('AdminPage.resetDone') : t('AdminPage.resetProfile')}
                          </button>
                          <BanToggle
                            boxed
                            banned={!!acct.banned}
                            pending={setBanned.isPending && setBanned.variables?.playerId === acct.player_id}
                            onBan={() => banPlayer({ player_id: acct.player_id, name: r.target_name || acct.join_name || acct.display_name })}
                            onUnban={() => setBanned.mutate({ playerId: acct.player_id, banned: false })}
                          />
                        </>
                      )}
                      {hostIsTarget && org && org.role !== 'superadmin' && (
                        <button
                          onClick={() =>
                            org.disabled ? toggleDisabled.mutate({ orgId: org.org_id, disabled: false }) : disableHost(org.org_id)
                          }
                          disabled={toggleDisabled.isPending}
                          className={`text-xs font-bold px-3 py-1.5 rounded-2xl border-2 disabled:opacity-50 ${
                            org.disabled ? 'border-emerald-200 text-emerald-600' : 'border-red-200 text-red-500'
                          }`}
                        >
                          {org.disabled ? t('AdminPage.enableHost') : t('AdminPage.disableHost')}
                        </button>
                      )}
                      {hostIsTarget && org?.disabled && (
                        <span className="text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full">{t('AdminPage.disabledBadge')}</span>
                      )}
                    </div>

                    {r.status === 'open' ? (
                      <div className="flex gap-2">
                        <input
                          value={notes[r.id] ?? ''}
                          onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                          placeholder={t('AdminPage.resolveNotePlaceholder')}
                          maxLength={200}
                          className="flex-1 min-w-0 border-2 border-gray-200 rounded-2xl px-3 py-1.5 text-sm focus:outline-none focus:border-brand-pink"
                        />
                        <button
                          onClick={() => resolveReport.mutate({ id: r.id, note: (notes[r.id] ?? '').trim() })}
                          disabled={resolveReport.isPending && resolveReport.variables?.id === r.id}
                          className="btn-primary px-4 py-1.5 text-xs shrink-0 disabled:opacity-50"
                        >
                          {t('AdminPage.markResolved')}
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-emerald-600">
                        {t('AdminPage.resolvedAt', { at: r.resolved_at ? fmtWhen(r.resolved_at) : '' })}
                        {r.resolved_note && <span className="text-gray-500"> · {r.resolved_note}</span>}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* === 意見回饋 === */}
          {tab === 'feedback' && (
            <div className="card space-y-2">
              <span className="font-bold text-gray-700">{t('AdminPage.feedbackTitle', { count: (feedback ?? []).length })}</span>
              {(feedback ?? []).length === 0 && <p className="text-sm text-gray-300">{t('AdminPage.noFeedback')}</p>}
              {(feedback ?? []).map((f) => (
                <div key={f.id} className="py-2 border-b last:border-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        f.role === 'leader' ? 'bg-brand-yellow text-amber-700' : 'bg-brand-mint text-emerald-700'
                      }`}
                    >
                      {f.role === 'leader' ? t('AdminPage.roleHost') : t('AdminPage.rolePlayer')}
                    </span>
                    <span className="font-semibold text-gray-700 text-sm">{f.author_name || t('AdminPage.anonymous')}</span>
                    {f.email && <span className="text-xs text-gray-400">{f.email}</span>}
                    <ClientBadge client={f.client} hideUnknown />
                    <span className="text-[11px] text-gray-300 ml-auto">{fmtWhen(f.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{f.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
