import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi, type SessionSummary } from '../api/client'
import { useConfirm } from '../components/Confirm'

function fmtRange(s: SessionSummary): string {
  if (!s.start_at) return ''
  const start = new Date(s.start_at)
  const hm = (d: Date) =>
    d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
  const day = `${start.getMonth() + 1}/${start.getDate()}`
  const tail = s.end_at ? `–${hm(new Date(s.end_at))}` : ''
  return `${day} ${hm(start)}${tail}`
}

export function AdminPage() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const confirm = useConfirm()
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

  const orgNameOf = (id: string) =>
    (orgs ?? []).find((o) => o.org_id === id)?.org_name ?? '未知'
  const leaderCount = (orgs ?? []).filter((o) => o.role === 'leader').length
  const sessions = (allSessions ?? []).slice().sort((a, b) =>
    (b.opened_at || '').localeCompare(a.opened_at || '')
  )
  const openCount = sessions.filter((s) => s.status === 'open').length

  const [email, setEmail] = useState('')
  const [orgName, setOrgName] = useState('')
  const [error, setError] = useState('')

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
  const toggleDisabled = useMutation({
    mutationFn: (v: { orgId: string; disabled: boolean }) =>
      adminApi.setDisabled(v.orgId, v.disabled),
    onSuccess: invalidate,
  })

  async function impersonate(orgId: string) {
    const res = await adminApi.impersonate(orgId)
    // stash the admin session so we can switch back
    localStorage.setItem('admin_token', localStorage.getItem('token') || '')
    localStorage.setItem('admin_org', localStorage.getItem('org') || '')
    localStorage.setItem('token', res.data.data.token)
    localStorage.setItem('org', JSON.stringify(res.data.data.org))
    nav('/')
  }

  return (
    <div className="min-h-screen bg-brand-bg pb-10">
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <button onClick={() => nav('/')} className="text-sm text-gray-400">← 返回</button>
        <span className="font-extrabold text-gray-800">超級管理員</span>
        <span className="w-12" />
      </header>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* stats */}
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

        <h2 className="text-xl font-extrabold text-gray-800">團主管理 👑</h2>

        <div className="card space-y-3">
          <span className="font-bold text-gray-700">新增團主</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="團主的 Google email"
            className="w-full border-2 border-gray-200 rounded-2xl px-4 py-2.5 text-sm
              focus:outline-none focus:border-brand-pink"
          />
          <input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="團體名稱"
            className="w-full border-2 border-gray-200 rounded-2xl px-4 py-2.5 text-sm
              focus:outline-none focus:border-brand-pink"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            onClick={() => create.mutate()}
            disabled={!email.trim() || !orgName.trim() || create.isPending}
            className="btn-primary w-full text-sm"
          >
            新增團主
          </button>
        </div>

        <div className="card space-y-2">
          <span className="font-bold text-gray-700">所有團主</span>
          {(orgs ?? []).map((o) => (
            <div key={o.org_id} className="flex items-center justify-between py-2 border-b last:border-0 gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-gray-700 truncate">
                  {o.org_name}
                  {o.role === 'superadmin' && (
                    <span className="ml-2 text-xs bg-brand-yellow text-amber-700 px-2 py-0.5 rounded-full">
                      管理員
                    </span>
                  )}
                  {o.disabled && (
                    <span className="ml-2 text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full">
                      已停用
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-400 truncate">{o.google_email}</p>
              </div>
              {o.role !== 'superadmin' && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => impersonate(o.org_id)}
                    className="text-xs font-semibold text-brand-pink"
                  >
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

        {/* all sessions across orgs */}
        <div className="card space-y-2">
          <span className="font-bold text-gray-700">所有開團</span>
          {sessions.length === 0 && <p className="text-sm text-gray-300">還沒有任何開團</p>}
          {sessions.map((s) => (
            <button
              key={s.session_id}
              onClick={() => nav(`/session/${s.session_id}`)}
              className="w-full text-left py-2 border-b last:border-0 flex items-center justify-between"
            >
              <div>
                <p className="font-semibold text-gray-700">
                  {s.title || '未命名'}
                  <span
                    className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                      s.status === 'open'
                        ? 'bg-brand-mint text-emerald-700'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {s.status === 'open' ? '進行中' : '已結束'}
                  </span>
                </p>
                <p className="text-xs text-gray-400">
                  {orgNameOf(s.org_id)}
                  {fmtRange(s) && <span> · {fmtRange(s)}</span>} · {s.num_courts} 場
                </p>
              </div>
              <span className="text-brand-pink text-sm font-semibold">查看 →</span>
            </button>
          ))}
        </div>

        {/* 意見回饋(玩家 + 團主)*/}
        <div className="card space-y-2">
          <span className="font-bold text-gray-700">💬 意見回饋 ({(feedback ?? []).length})</span>
          {(feedback ?? []).length === 0 && (
            <p className="text-sm text-gray-300">目前沒有任何回饋</p>
          )}
          {(feedback ?? []).map((f) => (
            <div key={f.id} className="py-2 border-b last:border-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    f.role === 'leader'
                      ? 'bg-brand-yellow text-amber-700'
                      : 'bg-brand-mint text-emerald-700'
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
      </div>
    </div>
  )
}
