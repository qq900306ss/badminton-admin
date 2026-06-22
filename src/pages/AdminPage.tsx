import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../api/client'

export function AdminPage() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const { data: orgs } = useQuery({
    queryKey: ['orgs'],
    queryFn: () => adminApi.listOrgs().then((r) => r.data.data),
  })

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

  return (
    <div className="min-h-screen bg-brand-bg pb-10">
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <button onClick={() => nav('/')} className="text-sm text-gray-400">← 返回</button>
        <span className="font-extrabold text-gray-800">超級管理員</span>
        <span className="w-12" />
      </header>

      <div className="max-w-md mx-auto p-4 space-y-4">
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
            <div key={o.org_id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <p className="font-semibold text-gray-700">
                  {o.org_name}
                  {o.role === 'superadmin' && (
                    <span className="ml-2 text-xs bg-brand-yellow text-amber-700 px-2 py-0.5 rounded-full">
                      管理員
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-400">{o.google_email}</p>
              </div>
              {o.role !== 'superadmin' && (
                <button onClick={() => remove.mutate(o.org_id)} className="text-red-300 text-xs">
                  刪除
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
