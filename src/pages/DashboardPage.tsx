import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FeedbackButton } from '../components/FeedbackButton'
import { sessionApi, type Org, type SessionSummary } from '../api/client'
import { InstallButton } from '../components/InstallButton'
import { useConfirm } from '../components/Confirm'
import { ChangelogButton } from '../components/ChangelogButton'
import { HelpButton } from '../components/HelpButton'
import { OrgAvatarCard } from '../components/OrgAvatarCard'
import { forceUpdate } from '../lib/appUpdate'
import { isPhotoUrl } from '../lib/avatar'
import { OnboardingCards, ONBOARD_KEY } from '../components/OnboardingCards'
import { Sheet } from '../components/manage/Sheet'
import { CreateSessionSheet } from '../components/dashboard/CreateSessionSheet'
import { LanguageRow } from '../components/LanguageSwitcher'

// tolerate corrupted localStorage without crashing the whole page
function readOrg(): Org | null {
  try {
    return JSON.parse(localStorage.getItem('org') || 'null')
  } catch {
    return null
  }
}

// "18:00–21:00"
function fmtTimes(s: { start_at?: string; end_at?: string }): string {
  if (!s.start_at) return ''
  const hm = (d: Date) => d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${hm(new Date(s.start_at))}${s.end_at ? `–${hm(new Date(s.end_at))}` : ''}`
}
// 「10/23(四)」
function fmtDay(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}(${d.toLocaleDateString('zh-TW', { weekday: 'narrow' })})`
}

// 團主首頁:手機優先。上面是自己的團(進行中做成大卡片),「開新團」和「照上一團再開」是固定在底部的大按鈕;
// 開團表單收進底部抽屜(見 CreateSessionSheet)。
export function DashboardPage() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const org: Org | null = readOrg()

  const { data: mySessions, isLoading } = useQuery({
    queryKey: ['my-sessions'],
    queryFn: () => sessionApi.mySessions().then((r) => r.data.data),
    refetchInterval: 60_000,
  })
  const hide = useMutation({
    mutationFn: (sessionId: string) => sessionApi.hide(sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-sessions'] }),
  })

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showOnboard, setShowOnboard] = useState(() => localStorage.getItem(ONBOARD_KEY) !== '1')
  const [creating, setCreating] = useState<{ from?: SessionSummary; password?: string; key: number } | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  // 現在時刻放 state(render 保持純),每分鐘更新 →「尚未開始 → 進行中」時間到自動換區
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const all = mySessions ?? []
  const openSessions = all.filter((s) => s.status === 'open')
  const notStarted = (s: SessionSummary) => !!s.start_at && new Date(s.start_at).getTime() > now
  const ongoing = openSessions.filter((s) => !notStarted(s))
  const upcoming = openSessions.filter(notStarted).sort((a, b) => (a.start_at || '').localeCompare(b.start_at || ''))
  const past = all.filter((s) => s.status !== 'open').sort((a, b) => (b.start_at || b.opened_at || '').localeCompare(a.start_at || a.opened_at || ''))
  // 「照上一團再開」= 最近開的那一團(團主多半每週照同一團開)
  const last = [...all].sort((a, b) => (b.opened_at || '').localeCompare(a.opened_at || ''))[0]

  // 照某一團再開:密碼也帶過去(團主自己的團才拿得到)
  async function repeat(s?: SessionSummary) {
    let password: string | undefined
    if (s) {
      try {
        password = (await sessionApi.getPassword(s.session_id)).data.data.password
      } catch {
        password = undefined // 舊團沒存明碼:讓團主自己填
      }
    }
    setCreating({ from: s, password, key: Date.now() })
  }

  const impersonating = !!localStorage.getItem('admin_token')
  function stopImpersonating() {
    localStorage.setItem('token', localStorage.getItem('admin_token') || '')
    localStorage.setItem('org', localStorage.getItem('admin_org') || '')
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_org')
    nav('/admin')
    location.reload()
  }

  const hour = new Date(now).getHours()
  const greet = hour < 11 ? t('Home.greetMorning') : hour < 18 ? t('Home.greetAfternoon') : t('Home.greetEvening')

  return (
    <div className="min-h-screen bg-[#FFF5F7] pb-36">
      {showOnboard && <OnboardingCards onClose={() => setShowOnboard(false)} />}
      {impersonating && (
        <div className="bg-amber-100 text-amber-800 text-sm font-semibold px-4 py-2 flex items-center justify-between">
          <span>{t('DashboardPage.impersonatingAs', { name: org?.org_name })}</span>
          <button onClick={stopImpersonating} className="underline font-bold">
            {t('DashboardPage.backToAdmin')}
          </button>
        </div>
      )}

      {/* 頂端:團主頭像 + 團名;右邊設定 */}
      <header className="px-4 pt-5 pb-3 flex items-center gap-3 max-w-xl mx-auto" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)' }}>
        {isPhotoUrl(org?.avatar_url) ? (
          <img src={org?.avatar_url} alt="" className="w-12 h-12 rounded-2xl object-cover shadow-sm" />
        ) : (
          <span className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-2xl">{org?.avatar_url || '🐰'}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-400">{greet}</p>
          <p className="font-extrabold text-gray-900 text-xl truncate">{org?.org_name || t('DashboardPage.dashboardTitle')}</p>
        </div>
        {org?.role === 'superadmin' && (
          <button onClick={() => nav('/admin')} className="h-10 px-3 rounded-2xl bg-white shadow-sm text-xs font-bold text-pink-600">
            {t('DashboardPage.admin')}
          </button>
        )}
        <button onClick={() => setSettingsOpen(true)} aria-label={t('DashboardPage.settings')} className="w-10 h-10 rounded-2xl bg-white shadow-sm text-lg">
          ⚙️
        </button>
      </header>

      <main className="max-w-xl mx-auto px-4 space-y-5">
        {isLoading && <div className="h-32 rounded-[1.75rem] bg-white/60 animate-pulse" />}

        {/* 進行中:大卡片,點了直接進場內管理 */}
        {ongoing.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-extrabold text-gray-400 px-1">{t('Home.ongoing')}</h2>
            {ongoing.map((s) => (
              <button
                key={s.session_id}
                onClick={() => nav(`/session/${s.session_id}`)}
                className="w-full text-left rounded-[1.75rem] p-4 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md active:scale-[0.99] transition-transform relative overflow-hidden"
              >
                <span className="absolute right-0 top-1/2 w-full h-0.5 bg-white/15" />
                <span className="absolute left-1/2 top-0 h-full w-0.5 bg-white/10" />
                <div className="relative flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold text-white/80">
                      <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> {t('Home.liveNow')} · {fmtTimes(s)}
                    </p>
                    <p className="font-extrabold text-xl truncate mt-0.5">{s.title || t('DashboardPage.untitled')}</p>
                    <p className="text-sm text-white/85 mt-1">
                      {t('Home.cardLine', { courts: s.num_courts, people: s.joined_count ?? 0, played: s.played_count ?? 0 })}
                    </p>
                  </div>
                  {!!s.pending_signups && (
                    <span className="shrink-0 text-[11px] font-extrabold bg-orange-500 text-white rounded-full px-2.5 py-1">
                      {t('Home.pendingSignups', { n: s.pending_signups })}
                    </span>
                  )}
                </div>
                <div className="relative mt-3 flex items-center justify-between">
                  <span className="text-xs text-white/70">{s.city}{s.district}</span>
                  <span className="text-sm font-extrabold bg-white text-emerald-700 rounded-full px-4 py-1.5">{t('Home.enter')} ›</span>
                </div>
              </button>
            ))}
          </section>
        )}

        {/* 即將開始 */}
        {upcoming.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-extrabold text-gray-400 px-1">{t('Home.upcoming')}</h2>
            <div className="bg-white rounded-3xl shadow-sm divide-y divide-gray-50 overflow-hidden">
              {upcoming.map((s) => (
                <button key={s.session_id} onClick={() => nav(`/session/${s.session_id}`)} className="w-full text-left flex items-center gap-3 px-4 py-3 active:bg-gray-50">
                  <span className="shrink-0 w-14 text-center">
                    <span className="block text-[11px] font-bold text-violet-500">{fmtDay(s.start_at)}</span>
                    <span className="block text-sm font-extrabold text-gray-800">{s.start_at ? fmtTimes({ start_at: s.start_at }) : ''}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-gray-800 truncate">{s.title || t('DashboardPage.untitled')}</span>
                    <span className="block text-xs text-gray-400">
                      {t('Home.rowLine', { courts: s.num_courts, people: s.joined_count ?? 0 })}
                      {!!s.pending_signups && <span className="text-orange-500 font-bold"> · {t('Home.pendingSignups', { n: s.pending_signups })}</span>}
                    </span>
                  </span>
                  <span className="text-gray-300 text-lg">›</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* 沒有任何開團 */}
        {!isLoading && openSessions.length === 0 && (
          <section className="rounded-[1.75rem] bg-white shadow-sm p-6 text-center space-y-2">
            <div className="text-4xl">🏸</div>
            <p className="font-extrabold text-gray-800">{t('Home.emptyTitle')}</p>
            <p className="text-sm text-gray-400">{t('Home.emptyHint')}</p>
          </section>
        )}

        {/* 歷史 */}
        {past.length > 0 && (
          <section className="space-y-2">
            <button onClick={() => setHistoryOpen((v) => !v)} className="w-full flex items-center justify-between px-1">
              <h2 className="text-xs font-extrabold text-gray-400">{t('Home.history', { n: past.length })}</h2>
              <span className="text-xs font-bold text-gray-400">{historyOpen ? t('Home.collapse') : t('Home.expand')}</span>
            </button>
            {historyOpen && (
              <div className="bg-white rounded-3xl shadow-sm divide-y divide-gray-50 overflow-hidden">
                {past.map((s) => (
                  <div key={s.session_id} className="flex items-center gap-2 pl-4 pr-2 py-2.5">
                    <button onClick={() => nav(`/session/${s.session_id}`)} className="min-w-0 flex-1 text-left">
                      <span className="block text-sm font-bold text-gray-700 truncate">{s.title || t('DashboardPage.untitled')}</span>
                      <span className="block text-[11px] text-gray-400">
                        {fmtDay(s.start_at || s.opened_at)} {fmtTimes(s)}
                        {s.joined_count !== undefined && ` · ${t('Home.rowLinePast', { people: s.joined_count, played: s.played_count ?? 0 })}`}
                      </span>
                    </button>
                    <button onClick={() => repeat(s)} className="shrink-0 text-xs font-bold text-pink-600 bg-pink-50 rounded-full px-3 py-1.5 active:scale-95">
                      ↻ {t('Home.repeat')}
                    </button>
                    <button
                      onClick={async () => {
                        if (await confirm({ message: t('DashboardPage.removeConfirm', { name: s.title || t('DashboardPage.untitled') }), confirmText: t('DashboardPage.remove'), danger: true }))
                          hide.mutate(s.session_id)
                      }}
                      disabled={hide.isPending}
                      className="shrink-0 w-8 h-8 rounded-full text-gray-300 text-lg active:bg-gray-100 disabled:opacity-40"
                      aria-label={t('DashboardPage.remove')}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <InstallButton label={t('DashboardPage.installLabel')} />
      </main>

      {/* 底部:開團(拇指區) */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-gradient-to-t from-[#FFF5F7] via-[#FFF5F7] to-transparent pt-6" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}>
        <div className="max-w-xl mx-auto px-4 flex gap-2">
          {last && (
            <button onClick={() => repeat(last)} className="flex-1 min-w-0 py-3.5 px-3 rounded-2xl bg-white shadow-md text-left active:scale-[0.99]">
              <span className="block text-[11px] font-bold text-gray-400">↻ {t('Home.repeatLast')}</span>
              <span className="block text-sm font-extrabold text-gray-800 truncate">{last.title || t('DashboardPage.untitled')}</span>
            </button>
          )}
          <button onClick={() => repeat()} className={`${last ? 'shrink-0 px-5' : 'flex-1'} py-3.5 rounded-2xl bg-pink-400 text-white font-extrabold shadow-md active:scale-[0.99]`}>
            ＋ {t('Home.newSession')}
          </button>
        </div>
      </div>

      {creating && (
        <CreateSessionSheet
          key={creating.key}
          open
          onClose={() => setCreating(null)}
          org={org}
          from={creating.from}
          fromPassword={creating.password}
          openCount={openSessions.length}
        />
      )}

      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title={t('DashboardPage.settings')}>
        <div className="space-y-3">
          <OrgAvatarCard org={org} />
          <div className="grid grid-cols-2 gap-2">
            <HelpButton className="btn-secondary text-sm col-span-2" />
            <button
              onClick={() => {
                setSettingsOpen(false)
                setShowOnboard(true)
              }}
              className="btn-secondary text-sm col-span-2"
            >
              {t('DashboardPage.tutorial')}
            </button>
            <ChangelogButton className="btn-secondary text-sm" />
            <FeedbackButton className="btn-secondary text-sm" />
            <button onClick={() => forceUpdate()} className="btn-secondary text-sm col-span-2" title={t('DashboardPage.updateHint')}>
              {t('DashboardPage.updateToLatest')}
            </button>
          </div>
          <LanguageRow />
          <button
            onClick={() => {
              localStorage.clear()
              nav('/login')
            }}
            className="w-full py-3 rounded-2xl border-2 border-gray-200 text-gray-500 text-sm font-bold"
          >
            {t('DashboardPage.logout')}
          </button>
        </div>
      </Sheet>
    </div>
  )
}
