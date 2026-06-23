import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { sessionApi, type Org } from '../api/client'
import { useMembers, useMemberActions } from '../hooks/useApi'
import { InstallButton } from '../components/InstallButton'

// local YYYY-MM-DD (en-CA formats as ISO date in local timezone)
const todayStr = () => new Date().toLocaleDateString('en-CA')

// combine a date + HH:mm into a full ISO timestamp (UTC), or undefined
function toISO(date: string, time: string): string | undefined {
  if (!date || !time) return undefined
  const d = new Date(`${date}T${time}`)
  return isNaN(d.getTime()) ? undefined : d.toISOString()
}

// "6/22 18:00–21:00" from ISO timestamps
function fmtRange(s: { start_at?: string; end_at?: string }): string {
  if (!s.start_at) return ''
  const start = new Date(s.start_at)
  const hm = (d: Date) =>
    d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
  const day = `${start.getMonth() + 1}/${start.getDate()}`
  const tail = s.end_at ? `–${hm(new Date(s.end_at))}` : ''
  return `${day} ${hm(start)}${tail}`
}

export function DashboardPage() {
  const nav = useNavigate()
  const org: Org | null = JSON.parse(localStorage.getItem('org') || 'null')
  const { data: members } = useMembers()
  const { add, remove } = useMemberActions()

  const { data: mySessions } = useQuery({
    queryKey: ['my-sessions'],
    queryFn: () => sessionApi.mySessions().then((r) => r.data.data),
  })
  const openSessions = (mySessions ?? []).filter((s) => s.status === 'open')
  const pastSessions = (mySessions ?? [])
    .filter((s) => s.status !== 'open')
    .sort((a, b) => (b.opened_at || '').localeCompare(a.opened_at || ''))

  const [title, setTitle] = useState('')
  const [password, setPassword] = useState('')
  const [numCourts, setNumCourts] = useState(4)
  const [date, setDate] = useState(todayStr())
  const [startTime, setStartTime] = useState('18:00')
  const [endTime, setEndTime] = useState('21:00')
  const [queueTime, setQueueTime] = useState('18:00')
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
      const res = await sessionApi.create({
        title: title.trim() || org?.org_name || '羽球團',
        password,
        num_courts: numCourts,
        player_names: playerNames,
        start_at: toISO(date, startTime),
        end_at: toISO(date, endTime),
        queue_open_at: toISO(date, queueTime),
      })
      nav(`/session/${res.data.data.session_id}`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? '開團失敗')
    } finally {
      setCreating(false)
    }
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

  return (
    <div className="min-h-screen bg-brand-bg pb-10">
      {impersonating && (
        <div className="bg-amber-100 text-amber-800 text-sm font-semibold px-4 py-2 flex items-center justify-between">
          <span>👁️ 正在以「{org?.org_name}」身份操作</span>
          <button onClick={stopImpersonating} className="underline font-bold">返回管理員</button>
        </div>
      )}
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
        {/* my ongoing sessions */}
        {openSessions.length > 0 && (
          <div className="card space-y-2">
            <span className="font-bold text-gray-700">進行中的開團 🏸</span>
            {openSessions.map((s) => (
              <button
                key={s.session_id}
                onClick={() => nav(`/session/${s.session_id}`)}
                className="w-full text-left px-4 py-3 rounded-2xl bg-brand-mint/40
                  hover:bg-brand-mint transition-colors flex items-center justify-between"
              >
                <div>
                  <p className="font-bold text-gray-700">{s.title || '未命名'}</p>
                  <p className="text-xs text-gray-500">
                    {fmtRange(s)} · {s.num_courts} 場
                  </p>
                </div>
                <span className="text-brand-pink font-semibold text-sm">管理 →</span>
              </button>
            ))}
          </div>
        )}

        {/* past sessions history */}
        {pastSessions.length > 0 && (
          <details className="card">
            <summary className="cursor-pointer font-bold text-gray-700">
              歷史開團 ({pastSessions.length})
            </summary>
            <div className="mt-3 space-y-1">
              {pastSessions.map((s) => (
                <button
                  key={s.session_id}
                  onClick={() => nav(`/session/${s.session_id}`)}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-50
                    flex items-center justify-between"
                >
                  <span className="text-gray-600">{s.title || '未命名'}</span>
                  <span className="text-xs text-gray-400">{fmtRange(s)}</span>
                </button>
              ))}
            </div>
          </details>
        )}

        <h2 className="text-xl font-extrabold text-gray-800">開新的一團 🎉</h2>

        {/* settings */}
        <div className="card space-y-4">
          <label className="block">
            <span className="text-sm font-bold text-gray-600">這場的名稱</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如 週六晚雙打團"
              className="mt-1 w-full border-2 border-gray-200 rounded-2xl px-4 py-2.5
                focus:outline-none focus:border-brand-pink"
            />
          </label>
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

          {/* schedule */}
          <label className="block">
            <span className="text-sm font-bold text-gray-600">日期</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full border-2 border-gray-200 rounded-2xl px-4 py-2.5
                focus:outline-none focus:border-brand-pink"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-bold text-gray-600">開打</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 w-full border-2 border-gray-200 rounded-2xl px-3 py-2.5
                  focus:outline-none focus:border-brand-pink"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-gray-600">結束</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 w-full border-2 border-gray-200 rounded-2xl px-3 py-2.5
                  focus:outline-none focus:border-brand-pink"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-bold text-gray-600">排隊開放時間</span>
            <input
              type="time"
              value={queueTime}
              onChange={(e) => setQueueTime(e.target.value)}
              className="mt-1 w-full border-2 border-gray-200 rounded-2xl px-4 py-2.5
                focus:outline-none focus:border-brand-pink"
            />
            <span className="text-xs text-gray-400">這時間之前,臨打人能進場看,但還不能自己排上場</span>
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

        <div className="pt-2">
          <InstallButton label="📲 安裝後台到桌面" />
        </div>
      </div>
    </div>
  )
}
