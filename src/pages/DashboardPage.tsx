import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sessionApi, type Org } from '../api/client'
import { useMembers, useMemberActions } from '../hooks/useApi'

export function DashboardPage() {
  const nav = useNavigate()
  const org: Org | null = JSON.parse(localStorage.getItem('org') || 'null')
  const { data: members } = useMembers()
  const { add, remove } = useMemberActions()

  const [password, setPassword] = useState('')
  const [numCourts, setNumCourts] = useState(4)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [newMember, setNewMember] = useState('')
  const [tempNames, setTempNames] = useState<string[]>([])
  const [tempInput, setTempInput] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  function toggle(name: string) {
    const next = new Set(selected)
    next.has(name) ? next.delete(name) : next.add(name)
    setSelected(next)
  }

  async function openSession() {
    if (!password.trim()) {
      setError('請設定場地密碼')
      return
    }
    setCreating(true)
    setError('')
    const playerNames = [...selected, ...tempNames]
    try {
      const res = await sessionApi.create(password, numCourts, playerNames)
      nav(`/session/${res.data.data.session_id}`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? '開團失敗')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg pb-10">
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏸</span>
          <span className="font-extrabold text-gray-800">團主後台</span>
        </div>
        <div className="flex items-center gap-3">
          {org?.role === 'superadmin' && (
            <button onClick={() => nav('/admin')} className="text-sm font-semibold text-brand-pink">
              管理員
            </button>
          )}
          <span className="text-sm text-gray-500">{org?.org_name}</span>
          <button
            onClick={() => {
              localStorage.clear()
              nav('/login')
            }}
            className="text-sm text-gray-400"
          >
            登出
          </button>
        </div>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-4">
        <h2 className="text-xl font-extrabold text-gray-800">開新的一團 🎉</h2>

        {/* settings */}
        <div className="card space-y-4">
          <label className="block">
            <span className="text-sm font-bold text-gray-600">場地密碼(臨打人進場用)</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="例如 1234"
              className="mt-1 w-full border-2 border-gray-200 rounded-2xl px-4 py-2.5
                focus:outline-none focus:border-brand-pink"
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-gray-600">球場數量</span>
            <div className="flex gap-2 mt-1">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => setNumCourts(n)}
                  className={`flex-1 py-2 rounded-2xl font-bold transition-colors ${
                    numCourts === n ? 'bg-brand-pink text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            {/* custom count for big halls (7+) */}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-gray-400">或自訂</span>
              <button
                onClick={() => setNumCourts(Math.max(1, numCourts - 1))}
                className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 font-bold active:scale-90"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={30}
                value={numCourts}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10)
                  if (!isNaN(v)) setNumCourts(Math.min(30, Math.max(1, v)))
                }}
                className="w-16 text-center border-2 border-gray-200 rounded-2xl py-1.5 font-bold
                  focus:outline-none focus:border-brand-pink"
              />
              <button
                onClick={() => setNumCourts(Math.min(30, numCourts + 1))}
                className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 font-bold active:scale-90"
              >
                ＋
              </button>
              <span className="text-xs text-gray-400">場(最多 30)</span>
            </div>
          </label>
        </div>

        {/* roster picker */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-gray-700">常駐名單</span>
            <span className="text-xs text-gray-400">勾選這次來的人</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(members ?? []).map((m) => (
              <button
                key={m.member_id}
                onClick={() => toggle(m.display_name)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  selected.has(m.display_name)
                    ? 'bg-brand-mint text-emerald-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {selected.has(m.display_name) ? '✓ ' : ''}
                {m.display_name}
              </button>
            ))}
            {(members ?? []).length === 0 && (
              <p className="text-sm text-gray-300">名單還是空的,先在下面新增吧</p>
            )}
          </div>
          {/* add to roster */}
          <div className="flex gap-2 border-t pt-3">
            <input
              value={newMember}
              onChange={(e) => setNewMember(e.target.value)}
              placeholder="新增常駐成員"
              className="flex-1 border-2 border-gray-200 rounded-2xl px-3 py-1.5 text-sm
                focus:outline-none focus:border-brand-pink"
            />
            <button
              onClick={() => {
                if (newMember.trim()) {
                  add.mutate(newMember.trim())
                  setNewMember('')
                }
              }}
              className="btn-secondary px-4 py-1.5 text-sm"
            >
              加入名單
            </button>
          </div>
        </div>

        {/* temp guests for this session only */}
        <div className="card space-y-3">
          <span className="font-bold text-gray-700">臨時加入(只限這場)</span>
          <div className="flex flex-wrap gap-2">
            {tempNames.map((n) => (
              <span
                key={n}
                className="px-3 py-1.5 rounded-full text-sm font-semibold bg-brand-yellow text-amber-700 flex items-center gap-1"
              >
                {n}
                <button onClick={() => setTempNames(tempNames.filter((x) => x !== n))}>×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={tempInput}
              onChange={(e) => setTempInput(e.target.value)}
              placeholder="臨時人員名字"
              className="flex-1 border-2 border-gray-200 rounded-2xl px-3 py-1.5 text-sm
                focus:outline-none focus:border-brand-pink"
            />
            <button
              onClick={() => {
                if (tempInput.trim() && !tempNames.includes(tempInput.trim())) {
                  setTempNames([...tempNames, tempInput.trim()])
                  setTempInput('')
                }
              }}
              className="btn-secondary px-4 py-1.5 text-sm"
            >
              加入
            </button>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <button onClick={openSession} disabled={creating} className="btn-primary w-full text-lg py-4">
          {creating ? '開團中...' : `🏸 開團(${selected.size + tempNames.length} 人)`}
        </button>

        {/* roster management hint */}
        {members && members.length > 0 && (
          <details className="text-sm text-gray-400">
            <summary className="cursor-pointer">管理常駐名單</summary>
            <div className="mt-2 space-y-1">
              {members.map((m) => (
                <div key={m.member_id} className="flex justify-between items-center px-2 py-1">
                  <span>{m.display_name}</span>
                  <button onClick={() => remove.mutate(m.member_id)} className="text-red-300 text-xs">
                    刪除
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}
