import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi, type Org, type SessionSummary } from '../../api/client'
import { useConfirm } from '../../components/Confirm'
import { ActionBtn, Pill, FilterRow, Select, SearchBox, Swatch, Stat } from './ui'
import { DAY, ago, errMsg, fmtDate, fmtRange, sessionState } from './format'

// 團主管理:每位團主的開團量、最近開團、平均人數,可搜尋/篩選/排序;點開看最近幾團與操作

type HostFilter = 'all' | 'active' | 'quiet' | 'never' | 'disabled'
type HostSort = 'recent' | 'sessions' | 'attendance' | 'created' | 'name'

interface HostRow {
  org: Org
  sessions: SessionSummary[] // 新到舊
  ongoing: number
  lastAt?: string // 最近一團的開打(或開團)時間
  attendance: number // 名單內總人次(已結束的名單保留 ~90 天)
  avg: number
}

const ACTIVE_DAYS = 30 // 30 天內有開團 = 活躍

export function HostsTab({
  orgs,
  sessions,
  now,
  onOpenSessions,
}: {
  orgs: Org[] | undefined
  sessions: SessionSummary[]
  now: number
  onOpenSessions: (orgId: string) => void
}) {
  const { t } = useTranslation()
  const nav = useNavigate()
  const qc = useQueryClient()
  const confirm = useConfirm()

  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<HostFilter>('all')
  const [sort, setSort] = useState<HostSort>('recent')
  const [open, setOpen] = useState<string | null>(null) // 展開中的團主
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [email, setEmail] = useState('')
  const [orgName, setOrgName] = useState('')
  const [error, setError] = useState('')

  const rows = useMemo<HostRow[]>(() => {
    const byOrg = new Map<string, SessionSummary[]>()
    for (const s of sessions) {
      const list = byOrg.get(s.org_id) ?? []
      list.push(s)
      byOrg.set(s.org_id, list)
    }
    return (orgs ?? [])
      .filter((o) => o.role !== 'superadmin')
      .map((o) => {
        const list = (byOrg.get(o.org_id) ?? []).slice().sort((a, b) => (b.start_at || b.opened_at).localeCompare(a.start_at || a.opened_at))
        const attendance = list.reduce((n, s) => n + (s.joined_count ?? 0), 0)
        const counted = list.filter((s) => s.joined_count !== undefined).length
        return {
          org: o,
          sessions: list,
          ongoing: list.filter((s) => sessionState(s, now) === 'ongoing').length,
          lastAt: list[0] ? list[0].start_at || list[0].opened_at : undefined,
          attendance,
          avg: counted ? Math.round((attendance / counted) * 10) / 10 : 0,
        }
      })
  }, [orgs, sessions, now])

  const isActive = (r: HostRow) => !!r.lastAt && now - new Date(r.lastAt).getTime() < ACTIVE_DAYS * DAY
  const matches: Record<HostFilter, (r: HostRow) => boolean> = {
    all: () => true,
    active: (r) => !r.org.disabled && isActive(r),
    quiet: (r) => !r.org.disabled && r.sessions.length > 0 && !isActive(r),
    never: (r) => !r.org.disabled && r.sessions.length === 0,
    disabled: (r) => !!r.org.disabled,
  }
  const counts = Object.fromEntries(
    (Object.keys(matches) as HostFilter[]).map((k) => [k, rows.filter(matches[k]).length])
  ) as Record<HostFilter, number>

  const shown = rows
    .filter(matches[filter])
    .filter((r) => {
      const s = q.trim().toLowerCase()
      return !s || r.org.org_name.toLowerCase().includes(s) || r.org.google_email.toLowerCase().includes(s)
    })
    .sort((a, b) => {
      switch (sort) {
        case 'sessions':
          return b.sessions.length - a.sessions.length
        case 'attendance':
          return b.attendance - a.attendance
        case 'created':
          return (b.org.created_at || '').localeCompare(a.org.created_at || '')
        case 'name':
          return a.org.org_name.localeCompare(b.org.org_name, 'zh-TW')
        default:
          return (b.lastAt || '').localeCompare(a.lastAt || '')
      }
    })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['orgs'] })
  const create = useMutation({
    mutationFn: () => adminApi.createOrg(email.trim(), orgName.trim()),
    onSuccess: () => {
      invalidate()
      setEmail('')
      setOrgName('')
      setError('')
      setShowAdd(false)
    },
    onError: (e) => setError(errMsg(e) ?? t('AdminPage.addHostFailed')),
  })
  const remove = useMutation({ mutationFn: (id: string) => adminApi.deleteOrg(id), onSuccess: invalidate })
  const rename = useMutation({
    mutationFn: (v: { id: string; name: string }) => adminApi.renameOrg(v.id, v.name),
    onSuccess: () => {
      invalidate()
      setEditing(null)
    },
  })
  const toggleDisabled = useMutation({
    mutationFn: (v: { id: string; disabled: boolean }) => adminApi.setDisabled(v.id, v.disabled),
    onSuccess: invalidate,
    onError: (e) => alert(errMsg(e) ?? t('AdminPage.actionFailed')),
  })

  async function impersonate(orgId: string) {
    try {
      const res = await adminApi.impersonate(orgId)
      localStorage.setItem('admin_token', localStorage.getItem('token') || '')
      localStorage.setItem('admin_org', localStorage.getItem('org') || '')
      localStorage.setItem('token', res.data.data.token)
      localStorage.setItem('org', JSON.stringify(res.data.data.org))
      nav('/')
    } catch (e) {
      alert(errMsg(e) ?? t('AdminPage.switchIdentityFailed'))
    }
  }

  return (
    <div className="space-y-3">
      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-gray-700">{t('AdminConsole.hostsTitle')}</span>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="text-xs font-bold px-3 py-1.5 rounded-2xl bg-brand-pink text-white"
          >
            {showAdd ? t('AdminConsole.cancel') : `＋ ${t('AdminPage.addHost')}`}
          </button>
        </div>
        {showAdd && (
          <div className="bg-gray-50 rounded-2xl p-3 space-y-2">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('AdminPage.hostEmailPlaceholder')}
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-2 text-sm focus:outline-none focus:border-brand-pink"
            />
            <input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder={t('AdminPage.groupNamePlaceholder')}
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-2 text-sm focus:outline-none focus:border-brand-pink"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={() => create.mutate()}
              disabled={!email.trim() || !orgName.trim() || create.isPending}
              className="btn-primary w-full text-sm py-2 disabled:opacity-50"
            >
              {t('AdminPage.addHost')}
            </button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <SearchBox value={q} onChange={setQ} placeholder={t('AdminConsole.hostSearch')} />
          <Select<HostSort>
            value={sort}
            onChange={setSort}
            options={[
              { value: 'recent', label: t('AdminConsole.sortRecentSession') },
              { value: 'sessions', label: t('AdminConsole.sortSessionCount') },
              { value: 'attendance', label: t('AdminConsole.sortAttendance') },
              { value: 'created', label: t('AdminConsole.sortCreated') },
              { value: 'name', label: t('AdminConsole.sortName') },
            ]}
          />
        </div>
        <FilterRow label={t('AdminConsole.filterStatus')}>
          {(['all', 'active', 'quiet', 'never', 'disabled'] as HostFilter[]).map((k) => (
            <Pill key={k} active={filter === k} onClick={() => setFilter(k)} count={counts[k]}>
              {t(`AdminConsole.host_${k}`, { days: ACTIVE_DAYS })}
            </Pill>
          ))}
        </FilterRow>
      </div>

      {!orgs && <p className="text-sm text-gray-300 px-2">{t('AdminPage.loading')}</p>}
      {orgs && shown.length === 0 && <p className="text-sm text-gray-300 px-2">{t('AdminConsole.noHosts')}</p>}

      {shown.map((r) => {
        const o = r.org
        const expanded = open === o.org_id
        return (
          <div key={o.org_id} className={`card p-0 overflow-hidden ${o.disabled ? 'opacity-70' : ''}`}>
            <button
              onClick={() => setOpen(expanded ? null : o.org_id)}
              className="w-full text-left p-4 flex items-center gap-3"
            >
              <Swatch url={o.avatar_url} fallback="🐰" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-gray-700 truncate flex items-center gap-1.5">
                  <span className="truncate">{o.org_name}</span>
                  {o.disabled && (
                    <span className="shrink-0 text-[10px] bg-red-100 text-red-500 px-2 py-0.5 rounded-full">{t('AdminPage.disabledBadge')}</span>
                  )}
                  {r.ongoing > 0 && (
                    <span className="shrink-0 text-[10px] bg-brand-mint text-emerald-700 px-2 py-0.5 rounded-full">
                      {t('AdminConsole.ongoingN', { n: r.ongoing })}
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-400 truncate">{o.google_email}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-extrabold text-gray-700">{t('AdminConsole.sessionsN', { n: r.sessions.length })}</p>
                <p className="text-[11px] text-gray-400">
                  {r.lastAt ? t('AdminConsole.lastOpened', { when: ago(r.lastAt, now, t) }) : t('AdminConsole.neverOpened')}
                </p>
              </div>
              <span className={`text-gray-300 transition-transform ${expanded ? 'rotate-90' : ''}`}>›</span>
            </button>

            {expanded && (
              <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50/50">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Stat label={t('AdminConsole.statSessions')} value={r.sessions.length} />
                  <Stat label={t('AdminConsole.statAttendance')} value={r.attendance} hint={t('AdminConsole.within90')} />
                  <Stat label={t('AdminConsole.statAvg')} value={r.avg || '—'} />
                  <Stat label={t('AdminConsole.statSince')} value={o.created_at ? fmtDate(o.created_at) : '—'} />
                </div>

                {r.sessions.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-gray-400">{t('AdminConsole.recentSessions')}</p>
                    {r.sessions.slice(0, 5).map((s) => (
                      <button
                        key={s.session_id}
                        onClick={() => nav(`/session/${s.session_id}`)}
                        className="w-full text-left flex items-center justify-between gap-2 text-sm py-1"
                      >
                        <span className="truncate text-gray-600">{s.title || t('AdminPage.untitled')}</span>
                        <span className="text-[11px] text-gray-400 shrink-0">
                          {fmtRange(s)}
                          {s.joined_count !== undefined && ` · 👥${s.joined_count}`}
                        </span>
                      </button>
                    ))}
                    <button onClick={() => onOpenSessions(o.org_id)} className="text-xs font-bold text-brand-pink">
                      {t('AdminConsole.allSessionsOf', { n: r.sessions.length })}
                    </button>
                  </div>
                )}

                {editing?.id === o.org_id ? (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={editing.name}
                      onChange={(e) => setEditing({ id: o.org_id, name: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editing.name.trim()) rename.mutate({ id: o.org_id, name: editing.name.trim() })
                        if (e.key === 'Escape') setEditing(null)
                      }}
                      className="flex-1 min-w-0 border-2 border-gray-200 rounded-2xl px-3 py-1.5 text-sm focus:outline-none focus:border-brand-pink"
                    />
                    <button
                      onClick={() => editing.name.trim() && rename.mutate({ id: o.org_id, name: editing.name.trim() })}
                      disabled={!editing.name.trim() || rename.isPending}
                      className="btn-primary px-4 py-1.5 text-xs disabled:opacity-50"
                    >
                      {t('AdminConsole.save')}
                    </button>
                    <button onClick={() => setEditing(null)} className="text-xs text-gray-400">
                      {t('AdminConsole.cancel')}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <ActionBtn onClick={() => impersonate(o.org_id)} tone="pink">
                      {t('AdminPage.impersonate')}
                    </ActionBtn>
                    <ActionBtn onClick={() => setEditing({ id: o.org_id, name: o.org_name })}>{t('AdminPage.rename')}</ActionBtn>
                    <ActionBtn
                      tone={o.disabled ? 'green' : 'amber'}
                      disabled={toggleDisabled.isPending}
                      onClick={async () => {
                        if (o.disabled) return toggleDisabled.mutate({ id: o.org_id, disabled: false })
                        if (
                          await confirm({
                            message: t('AdminPage.disableHostConfirm', { name: o.org_name }),
                            confirmText: t('AdminPage.disableHost'),
                            danger: true,
                          })
                        )
                          toggleDisabled.mutate({ id: o.org_id, disabled: true })
                      }}
                    >
                      {o.disabled ? t('AdminPage.enable') : t('AdminPage.disable')}
                    </ActionBtn>
                    <ActionBtn
                      tone="red"
                      onClick={async () => {
                        if (
                          await confirm({
                            message: t('AdminPage.deleteHostConfirm', { name: o.org_name }),
                            confirmText: t('AdminPage.delete'),
                            danger: true,
                          })
                        )
                          remove.mutate(o.org_id)
                      }}
                    >
                      {t('AdminPage.delete')}
                    </ActionBtn>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
