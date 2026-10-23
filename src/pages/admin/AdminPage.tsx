import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '../../api/client'
import { DAY, sessionState, type SessionState } from './format'
import { HostsTab } from './HostsTab'
import { SessionsTab } from './SessionsTab'
import { MembersTab } from './MembersTab'
import { MemberDetail } from './MemberDetail'
import { ReportsTab } from './ReportsTab'
import { FeedbackTab } from './FeedbackTab'

// 超級後台外框:總覽數字 + 分頁。分頁、篩選的團主、打開的成員都放網址參數,
// 重新整理或按上一頁會回到同一個畫面。

type Tab = 'orgs' | 'sessions' | 'members' | 'reports' | 'feedback'
const TABS: Tab[] = ['orgs', 'sessions', 'members', 'reports', 'feedback']

export function AdminPage() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = (TABS.includes(params.get('tab') as Tab) ? params.get('tab') : 'orgs') as Tab
  const orgFilter = params.get('org') ?? ''
  const memberId = params.get('member')
  const stateParam = params.get('state') as SessionState | null

  // 改網址參數;push=true 會留在瀏覽紀錄(上一頁能回來),篩選這種小變動用 replace
  const patch = (next: Record<string, string | null>, push = false) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v)
      else p.delete(k)
    }
    setParams(p, { replace: !push, state: push && next.member ? { memberOpened: true } : undefined })
  }
  // 關詳情:是從列表點開的就回上一頁(瀏覽紀錄不留一堆詳情),直接開網址進來的就只拿掉參數
  const closeMember = () => (window.history.state?.usr?.memberOpened ? nav(-1) : patch({ member: null }))
  const goTab = (k: Tab, extra: Record<string, string | null> = {}) =>
    patch({ tab: k, org: null, state: null, ...extra }, true)

  // 現在時刻放 state(render 保持純),每分鐘更新 → 時間到自動變進行中
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const { data: orgs } = useQuery({
    queryKey: ['orgs'],
    queryFn: () => adminApi.listOrgs().then((r) => r.data.data),
  })
  const { data: allSessions } = useQuery({
    queryKey: ['admin-sessions'],
    queryFn: () => adminApi.listSessions().then((r) => r.data.data),
    // 這支每次都會把所有團的名單各讀一遍(團越多越貴);1 分鐘對帳一次就夠,切到別的分頁時不輪詢
    refetchInterval: 60_000,
  })
  const { data: players } = useQuery({
    queryKey: ['admin-players'],
    queryFn: () => adminApi.listPlayers().then((r) => r.data.data),
    refetchInterval: tab === 'reports' ? 60000 : false, // 跟待處理檢舉同步,新帳號被檢舉才拿得到處理鈕
  })
  // 成員詳情要用統計;成員分頁也會拉,共用快取
  const { data: stats } = useQuery({
    queryKey: ['admin-player-stats'],
    queryFn: () => adminApi.playerStats().then((r) => r.data.data ?? {}),
    staleTime: 60_000,
    enabled: tab === 'members' || !!memberId,
  })
  const { data: feedback } = useQuery({
    queryKey: ['admin-feedback'],
    queryFn: () => adminApi.listFeedback().then((r) => r.data.data),
  })
  // 待處理檢舉:導覽 badge 也靠它 → 一直拉、每分鐘對帳(承諾 24 小時內處理)
  const { data: openReports, isError: openReportsErr } = useQuery({
    queryKey: ['admin-reports', 'open'],
    queryFn: () => adminApi.listReports('open').then((r) => r.data.data ?? []),
    refetchInterval: 60000,
  })

  const sessions = useMemo(() => allSessions ?? [], [allSessions])
  const leaderCount = (orgs ?? []).filter((o) => o.role === 'leader').length
  const ongoing = sessions.filter((s) => sessionState(s, now) === 'ongoing').length
  const startOfToday = new Date(now).setHours(0, 0, 0, 0)
  const today = sessions.filter((s) => {
    const ts = new Date(s.start_at || s.opened_at).getTime()
    return ts >= startOfToday && ts < startOfToday + DAY
  }).length
  const active7 = (players ?? []).filter((p) => p.last_seen_at && now - new Date(p.last_seen_at).getTime() < 7 * DAY).length
  const openReportCount = openReports?.length ?? 0
  const member = memberId ? (players ?? []).find((p) => p.player_id === memberId) : undefined

  const NAV: { key: Tab; label: string; badge?: number }[] = [
    { key: 'orgs', label: t('AdminPage.navHosts') },
    { key: 'sessions', label: t('AdminPage.navSessions') },
    { key: 'members', label: t('AdminPage.navMembers') },
    { key: 'reports', label: t('AdminPage.navReports'), badge: openReportCount },
    { key: 'feedback', label: `${t('AdminPage.navFeedback')}${feedback?.length ? ` (${feedback.length})` : ''}` },
  ]
  const STATS = [
    { label: t('AdminPage.statHosts'), value: leaderCount, emoji: '🧑‍🏫', onClick: () => goTab('orgs') },
    { label: t('AdminPage.statActive'), value: ongoing, emoji: '🏸', onClick: () => goTab('sessions', { state: 'ongoing' }) },
    { label: t('AdminConsole.statToday'), value: today, emoji: '📅', onClick: () => goTab('sessions') },
    { label: t('AdminPage.statTotalSessions'), value: sessions.length, emoji: '📋', onClick: () => goTab('sessions') },
    { label: t('AdminConsole.statPlayers'), value: players?.length ?? '…', emoji: '🧑‍🤝‍🧑', onClick: () => goTab('members') },
    { label: t('AdminConsole.statActive7'), value: players ? active7 : '…', emoji: '🔥', onClick: () => goTab('members') },
  ]

  return (
    <div className="min-h-screen bg-brand-bg pb-10">
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        {/* 一律回「上一頁」(瀏覽歷史),沒有上一頁才 fallback 回前台 */}
        <button
          onClick={() => ((window.history.state?.idx ?? 0) > 0 ? nav(-1) : nav('/'))}
          className="text-sm text-gray-400"
        >
          {t('AdminPage.back')}
        </button>
        <span className="font-extrabold text-gray-800">{t('AdminPage.superAdmin')}</span>
        <span className="w-12" />
      </header>

      <div className="max-w-6xl mx-auto p-4 md:flex md:gap-4 md:items-start">
        <nav className="flex md:flex-col gap-1 overflow-x-auto md:w-44 md:shrink-0 mb-3 md:mb-0 md:sticky md:top-16">
          {NAV.map((n) => (
            <button
              key={n.key}
              onClick={() => goTab(n.key)}
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
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
            {STATS.map((stat) => (
              <button
                key={stat.label}
                onClick={stat.onClick}
                className="card text-center py-2.5 px-1 active:scale-95 transition-transform hover:ring-2 hover:ring-brand-pink/40"
              >
                <div className="text-xl">{stat.emoji}</div>
                <div className="text-xl font-extrabold text-gray-800">{stat.value}</div>
                <div className="text-[11px] text-gray-400 truncate">{stat.label}</div>
              </button>
            ))}
          </div>

          {tab === 'orgs' && (
            <HostsTab orgs={orgs} sessions={sessions} now={now} onOpenSessions={(id) => goTab('sessions', { org: id })} />
          )}
          {tab === 'sessions' && (
            <SessionsTab
              // 從總覽卡片跳過來帶不同狀態 → 重新掛載,狀態從網址重新帶入
              key={stateParam ?? ''}
              orgs={orgs}
              sessions={sessions}
              now={now}
              orgFilter={orgFilter}
              setOrgFilter={(id) => patch({ org: id || null })}
              initialState={stateParam ?? 'all'}
            />
          )}
          {tab === 'members' && (
            <MembersTab
              players={players}
              orgs={orgs}
              sessions={sessions}
              now={now}
              onOpen={(id) => patch({ member: id }, true)}
            />
          )}
          {tab === 'reports' && (
            <ReportsTab
              orgs={orgs}
              players={players}
              openReports={openReports}
              openReportsErr={openReportsErr}
              onOpenMember={(id) => patch({ member: id }, true)}
            />
          )}
          {tab === 'feedback' && <FeedbackTab feedback={feedback} />}
        </div>
      </div>

      {member && (
        <MemberDetail
          key={member.player_id}
          player={member}
          stats={stats?.[member.player_id]}
          orgs={orgs}
          now={now}
          onClose={closeMember}
          onOpenMember={(id) => patch({ member: id }, true)}
        />
      )}
    </div>
  )
}
