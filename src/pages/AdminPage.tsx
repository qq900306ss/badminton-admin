import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi, type SessionSummary, type AdminPlayer } from '../api/client'
import { useConfirm } from '../components/Confirm'
import { isPhotoUrl } from '../lib/avatar'

function fmtRange(s: SessionSummary): string {
  if (!s.start_at) return ''
  const start = new Date(s.start_at)
  const hm = (d: Date) =>
    d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
  const day = `${start.getMonth() + 1}/${start.getDate()}`
  const tail = s.end_at ? `–${hm(new Date(s.end_at))}` : ''
  return `${day} ${hm(start)}${tail}`
}

type Tab = 'orgs' | 'sessions' | 'members' | 'feedback'

// avatar swatch: photo URL → <img>, emoji string → glyph, else first letter
function Swatch({ url, fallback }: { url?: string; fallback: string }) {
  if (isPhotoUrl(url)) return <img src={url} alt="" className="w-10 h-10 rounded-full object-cover" />
  return (
    <span className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg">
      {url || fallback}
    </span>
  )
}

export function AdminPage() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const confirm = useConfirm()

  const [tab, setTab] = useState<Tab>('orgs')
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null) // filter sessions by leader
  const [email, setEmail] = useState('')
  const [orgName, setOrgName] = useState('')
  const [error, setError] = useState('')

  const { data: orgs } = useQuery({
    queryKey: ['orgs'],
    queryFn: () => adminApi.listOrgs().then((r) => r.data.data),
  })
  const { data: allSessions } = useQuery({
    queryKey: ['admin-sessions'],
    queryFn: () => adminApi.listSessions().then((r) => r.data.data),
    refetchInterval: 5000,
  })
  const { data: feedback } = useQuery({
    queryKey: ['admin-feedback'],
    queryFn: () => adminApi.listFeedback().then((r) => r.data.data),
  })
  const { data: players } = useQuery({
    queryKey: ['admin-players'],
    queryFn: () => adminApi.listPlayers().then((r) => r.data.data),
    enabled: tab === 'members', // only scan when needed
  })

  const orgNameOf = (id: string) => (orgs ?? []).find((o) => o.org_id === id)?.org_name ?? '未知'
  const leaderCount = (orgs ?? []).filter((o) => o.role === 'leader').length
  const sessions = (allSessions ?? [])
    .slice()
    .sort((a, b) => (b.opened_at || '').localeCompare(a.opened_at || ''))
  const openCount = sessions.filter((s) => s.status === 'open').length
  const shownSessions = selectedOrg ? sessions.filter((s) => s.org_id === selectedOrg) : sessions

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
      setError(msg ?? '新增失敗')
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
  const toggleDisabled = useMutation({
    mutationFn: (v: { orgId: string; disabled: boolean }) => adminApi.setDisabled(v.orgId, v.disabled),
    onSuccess: invalidate,
  })

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
      setError(msg ?? '切換身份失敗')
    }
  }

  const NAV: { key: Tab; label: string }[] = [
    { key: 'orgs', label: '👑 團主管理' },
    { key: 'sessions', label: '📋 所有開團' },
    { key: 'members', label: '🧑‍🤝‍🧑 成員管理' },
    { key: 'feedback', label: `💬 意見回饋${feedback?.length ? ` (${feedback.length})` : ''}` },
  ]

  return (
    <div className="min-h-screen bg-brand-bg pb-10">
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <button onClick={() => nav('/')} className="text-sm text-gray-400">← 返回</button>
        <span className="font-extrabold text-gray-800">超級管理員</span>
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
            </button>
          ))}
        </nav>

        <div className="flex-1 min-w-0 space-y-4">
          {/* stats — always on top */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '團主', value: leaderCount, emoji: '🧑‍🏫' },
              { label: '進行中', value: openCount, emoji: '🏸' },
              { label: '總場次', value: sessions.length, emoji: '📋' },
            ].map((stat) => (
              <div key={stat.label} className="card text-center py-3">
                <div className="text-2xl">{stat.emoji}</div>
                <div className="text-2xl font-extrabold text-gray-800">{stat.value}</div>
                <div className="text-xs text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* === 團主管理 === */}
          {tab === 'orgs' && (
            <>
              <div className="card space-y-3">
                <span className="font-bold text-gray-700">新增團主</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="團主的 Google email"
                  className="w-full border-2 border-gray-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-pink"
                />
                <input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="團體名稱"
                  className="w-full border-2 border-gray-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-pink"
                />
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <button
                  onClick={() => create.mutate()}
                  disabled={!email.trim() || !orgName.trim() || create.isPending}
                  className="btn-primary w-full text-sm disabled:opacity-50"
                >
                  新增團主
                </button>
              </div>

              <div className="card space-y-2">
                <span className="font-bold text-gray-700">所有團主(點名字看他的開團)</span>
                {(orgs ?? []).map((o) => (
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
                          <span className="ml-2 text-xs bg-brand-yellow text-amber-700 px-2 py-0.5 rounded-full">管理員</span>
                        )}
                        {o.disabled && (
                          <span className="ml-2 text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full">已停用</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{o.google_email}</p>
                    </button>
                    {o.role !== 'superadmin' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            const n = window.prompt('新團名', o.org_name)?.trim()
                            if (n) renameOrg.mutate({ orgId: o.org_id, name: n })
                          }}
                          className="text-xs font-semibold text-gray-500"
                        >
                          改名
                        </button>
                        <button onClick={() => impersonate(o.org_id)} className="text-xs font-semibold text-brand-pink">
                          以此身份
                        </button>
                        <button
                          onClick={() => toggleDisabled.mutate({ orgId: o.org_id, disabled: !o.disabled })}
                          className={`text-xs font-semibold ${o.disabled ? 'text-emerald-500' : 'text-amber-500'}`}
                        >
                          {o.disabled ? '啟用' : '停用'}
                        </button>
                        <button
                          onClick={async () => {
                            if (await confirm({ message: `刪除團主「${o.org_name}」?`, confirmText: '刪除', danger: true })) {
                              remove.mutate(o.org_id)
                            }
                          }}
                          className="text-red-300 text-xs"
                        >
                          刪除
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
            <div className="card space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-700">
                  {selectedOrg ? `${orgNameOf(selectedOrg)} 的開團` : '所有開團'}
                </span>
                {selectedOrg && (
                  <button onClick={() => setSelectedOrg(null)} className="text-xs font-semibold text-brand-pink">
                    顯示全部 ✕
                  </button>
                )}
              </div>
              {shownSessions.length === 0 && <p className="text-sm text-gray-300">沒有開團紀錄</p>}
              {shownSessions.map((s) => (
                <button
                  key={s.session_id}
                  onClick={() => nav(`/session/${s.session_id}`)}
                  className="w-full text-left py-2 border-b last:border-0 flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-700 truncate">
                      {s.title || '未命名'}
                      <span
                        className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                          s.status === 'open' ? 'bg-brand-mint text-emerald-700' : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {s.status === 'open' ? '進行中' : '已結束'}
                      </span>
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {orgNameOf(s.org_id)}
                      {fmtRange(s) && <span> · {fmtRange(s)}</span>} · {s.num_courts} 場
                    </p>
                  </div>
                  <span className="text-brand-pink text-sm font-semibold shrink-0">查看 →</span>
                </button>
              ))}
            </div>
          )}

          {/* === 成員管理 === */}
          {tab === 'members' && (
            <div className="card space-y-2">
              <span className="font-bold text-gray-700">所有玩家帳號 ({players?.length ?? 0})</span>
              <p className="text-[11px] text-gray-400">左:登入時的名字/大頭貼　右:目前使用的名稱/頭像</p>
              {!players && <p className="text-sm text-gray-300">載入中…</p>}
              {players?.length === 0 && <p className="text-sm text-gray-300">還沒有玩家</p>}
              {(players ?? []).map((p: AdminPlayer) => (
                <div key={p.player_id} className="py-2 border-b last:border-0 flex items-center gap-3">
                  {/* login identity */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Swatch url={p.photo_url} fallback={(p.display_name || '?')[0]} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-700 truncate">{p.display_name || '(無名)'}</p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {p.provider === 'line' ? 'LINE' : 'Google'}
                        {p.email ? ` · ${p.email}` : ''}
                      </p>
                    </div>
                  </div>
                  <span className="text-gray-300 shrink-0">→</span>
                  {/* current identity */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Swatch url={p.avatar_url} fallback={(p.join_name || p.display_name || '?')[0]} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-700 truncate">
                        {p.join_name || p.display_name || '(無名)'}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {p.default_level ? `預設 Lv${p.default_level}` : '未設程度'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* === 意見回饋 === */}
          {tab === 'feedback' && (
            <div className="card space-y-2">
              <span className="font-bold text-gray-700">💬 意見回饋 ({(feedback ?? []).length})</span>
              {(feedback ?? []).length === 0 && <p className="text-sm text-gray-300">目前沒有任何回饋</p>}
              {(feedback ?? []).map((f) => (
                <div key={f.id} className="py-2 border-b last:border-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        f.role === 'leader' ? 'bg-brand-yellow text-amber-700' : 'bg-brand-mint text-emerald-700'
                      }`}
                    >
                      {f.role === 'leader' ? '團主' : '玩家'}
                    </span>
                    <span className="font-semibold text-gray-700 text-sm">{f.author_name || '(匿名)'}</span>
                    {f.email && <span className="text-xs text-gray-400">{f.email}</span>}
                    <span className="text-[11px] text-gray-300 ml-auto">
                      {new Date(f.created_at).toLocaleString('zh-TW', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}
                    </span>
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
