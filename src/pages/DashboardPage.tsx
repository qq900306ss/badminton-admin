import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FeedbackButton } from '../components/FeedbackButton'
import { sessionApi, type Org } from '../api/client'
import { InstallButton } from '../components/InstallButton'
import { TimeSelect } from '../components/TimeSelect'
import { useConfirm } from '../components/Confirm'
import { ChangelogButton } from '../components/ChangelogButton'
import { HelpButton } from '../components/HelpButton'
import { OrgAvatarCard } from '../components/OrgAvatarCard'
import { forceUpdate } from '../lib/appUpdate'
import { TW_CITIES } from '../lib/twCities'
import { TW_DISTRICTS } from '../lib/twDistricts'
import { OnboardingCards, ONBOARD_KEY } from '../components/OnboardingCards'

// tolerate corrupted localStorage without crashing the whole page
function readOrg(): Org | null {
  try {
    return JSON.parse(localStorage.getItem('org') || 'null')
  } catch {
    return null
  }
}

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
  const qc = useQueryClient()
  const confirm = useConfirm()
  const org: Org | null = readOrg()

  const { data: mySessions } = useQuery({
    queryKey: ['my-sessions'],
    queryFn: () => sessionApi.mySessions().then((r) => r.data.data),
  })
  const hide = useMutation({
    mutationFn: (sessionId: string) => sessionApi.hide(sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-sessions'] }),
  })

  const [settingsOpen, setSettingsOpen] = useState(false)
  // 首次使用 → 翻頁導覽;之後可從 ⚙️ 設定重看
  const [showOnboard, setShowOnboard] = useState(
    () => localStorage.getItem(ONBOARD_KEY) !== '1'
  )
  const openSessions = (mySessions ?? []).filter((s) => s.status === 'open')
  const MAX_OPEN = 7 // 與後端 maxOpenPerOrg 一致;同時開團上限,擋濫開
  const atOpenLimit = openSessions.length >= MAX_OPEN
  const pastSessions = (mySessions ?? [])
    .filter((s) => s.status !== 'open')
    .sort((a, b) => (b.opened_at || '').localeCompare(a.opened_at || ''))

  const [title, setTitle] = useState('')
  const [city, setCity] = useState('台中市')
  const [district, setDistrict] = useState('')
  const [password, setPassword] = useState('')
  const [numCourts, setNumCourts] = useState(4)
  const [date, setDate] = useState(todayStr())
  const [startTime, setStartTime] = useState('18:00')
  const [endTime, setEndTime] = useState('21:00')
  const [queueTime, setQueueTime] = useState('18:00')
  const [contactUrl, setContactUrl] = useState('')
  const [description, setDescription] = useState('')
  const [signupOpen, setSignupOpen] = useState(false)
  const [signupQuota, setSignupQuota] = useState('') // 空字串 = 不限
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  async function openSession() {
    if (!password.trim()) {
      setError('請設定場地密碼')
      return
    }
    if (!district.trim()) {
      setError('請選擇(或填寫)區')
      return
    }
    const contact = contactUrl.trim()
    if (contact && !/^https?:\/\//.test(contact)) {
      setError('聯繫連結需以 http:// 或 https:// 開頭')
      return
    }
    const desc = description.trim()
    if ([...desc].length > 300) {
      setError('簡介最多 300 字')
      return
    }
    const quota = signupQuota.trim() === '' ? 0 : Number(signupQuota)
    if (!Number.isInteger(quota) || quota < 0 || quota > 200) {
      setError('名額請填 1~200 的整數(留空=不限)')
      return
    }
    setCreating(true)
    setError('')
    try {
      const res = await sessionApi.create({
        title: title.trim() || org?.org_name || '羽球團',
        city,
        district: district.trim(),
        password,
        num_courts: numCourts,
        player_names: [],
        start_at: toISO(date, startTime),
        end_at: toISO(date, endTime),
        queue_open_at: toISO(date, queueTime),
        contact_url: contact || undefined,
        description: desc || undefined,
        signup_open: signupOpen || undefined,
        signup_quota: quota || undefined,
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
      {showOnboard && <OnboardingCards onClose={() => setShowOnboard(false)} />}
      {impersonating && (
        <div className="bg-amber-100 text-amber-800 text-sm font-semibold px-4 py-2 flex items-center justify-between">
          <span>👁️ 正在以「{org?.org_name}」身份操作</span>
          <button onClick={stopImpersonating} className="underline font-bold">返回管理員</button>
        </div>
      )}
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between gap-2 sticky top-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl shrink-0">🏸</span>
          <span className="font-extrabold text-gray-800 truncate">團主後台</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {org?.role === 'superadmin' && (
            <button onClick={() => nav('/admin')} className="text-sm font-semibold text-brand-pink whitespace-nowrap">
              管理員
            </button>
          )}
          <button
            onClick={() => setSettingsOpen(true)}
            className="text-sm text-gray-500 hover:text-brand-pink whitespace-nowrap"
            title="設定"
          >
            ⚙️ 設定
          </button>
          <button
            onClick={() => {
              localStorage.clear()
              nav('/login')
            }}
            className="text-sm text-gray-400 whitespace-nowrap"
          >
            登出
          </button>
        </div>
      </header>

      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6"
          onClick={() => setSettingsOpen(false)}
        >
          <div className="w-full max-w-sm space-y-3 max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end">
              <button
                onClick={() => setSettingsOpen(false)}
                className="text-white font-bold text-sm bg-black/30 rounded-full px-3 py-1"
              >
                ✕ 關閉
              </button>
            </div>
            <OrgAvatarCard org={org} />
            <div className="card grid grid-cols-2 gap-2">
              <HelpButton className="btn-secondary text-sm col-span-2" />
              <button
                onClick={() => { setSettingsOpen(false); setShowOnboard(true) }}
                className="btn-secondary text-sm col-span-2"
              >
                📖 使用教學(重看導覽)
              </button>
              <ChangelogButton className="btn-secondary text-sm" />
              <FeedbackButton className="btn-secondary text-sm" />
              <button
                onClick={() => forceUpdate()}
                className="btn-secondary text-sm col-span-2"
                title="清除快取、更新到最新版"
              >
                🔄 更新到最新版
              </button>
            </div>
          </div>
        </div>
      )}

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
                <div className="min-w-0">
                  <p className="font-bold text-gray-700 flex items-center gap-2 flex-wrap">
                    {s.title || '未命名'}
                    {!!s.playing_courts && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-brand-pink/15 text-brand-pink font-semibold">
                        🏸 開打中 {s.playing_courts}
                      </span>
                    )}
                    {!!s.pending_signups && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
                        🙋 報名 {s.pending_signups}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {fmtRange(s)} · {s.num_courts} 場
                  </p>
                </div>
                <span className="text-brand-pink font-semibold text-sm shrink-0">管理 →</span>
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
                <div
                  key={s.session_id}
                  className="px-3 py-2 rounded-xl hover:bg-gray-50 flex items-center gap-2"
                >
                  <button
                    onClick={() => nav(`/session/${s.session_id}`)}
                    className="flex-1 text-left flex items-center justify-between gap-2 min-w-0"
                  >
                    <span className="text-gray-600 truncate">{s.title || '未命名'}</span>
                    <span className="text-xs text-gray-400 shrink-0">{fmtRange(s)}</span>
                  </button>
                  <button
                    onClick={async () => {
                      if (
                        await confirm({
                          message: `從歷史清單移除「${s.title || '未命名'}」?資料仍會保留一段時間,只是不再顯示在這裡。`,
                          confirmText: '移除',
                          danger: true,
                        })
                      ) {
                        hide.mutate(s.session_id)
                      }
                    }}
                    disabled={hide.isPending}
                    className="text-gray-300 hover:text-red-400 text-lg shrink-0 px-1 disabled:opacity-40"
                    aria-label="移除"
                  >
                    ×
                  </button>
                </div>
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
              maxLength={20}
              className="mt-1 w-full border-2 border-gray-200 rounded-2xl px-4 py-2.5
                focus:outline-none focus:border-brand-pink"
            />
            <span className="text-xs text-gray-400">最多 20 字</span>
          </label>
          <div className="flex gap-2">
            <label className="block flex-1">
              <span className="text-sm font-bold text-gray-600">縣市</span>
              <select
                value={city}
                onChange={(e) => {
                  setCity(e.target.value)
                  setDistrict('') // 換縣市就清掉舊的區
                }}
                className="mt-1 w-full border-2 border-gray-200 rounded-2xl px-3 py-2.5 bg-white
                  focus:outline-none focus:border-brand-pink"
              >
                {TW_CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block flex-1">
              <span className="text-sm font-bold text-gray-600">區</span>
              {TW_DISTRICTS[city] ? (
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="mt-1 w-full border-2 border-gray-200 rounded-2xl px-3 py-2.5 bg-white
                    focus:outline-none focus:border-brand-pink"
                >
                  <option value="">選擇區</option>
                  {TW_DISTRICTS[city].map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="例如 竹北市"
                  className="mt-1 w-full border-2 border-gray-200 rounded-2xl px-3 py-2.5
                    focus:outline-none focus:border-brand-pink"
                />
              )}
            </label>
          </div>
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
          <div>
            <span className="text-sm font-bold text-gray-600">開打時間</span>
            <TimeSelect value={startTime} onChange={setStartTime} />
          </div>
          <div>
            <span className="text-sm font-bold text-gray-600">結束時間</span>
            <TimeSelect value={endTime} onChange={setEndTime} />
          </div>
          <div>
            <span className="text-sm font-bold text-gray-600">排隊開放時間</span>
            <TimeSelect value={queueTime} onChange={setQueueTime} />
            <span className="text-xs text-gray-400">這時間之前,臨打人能進場看,但還不能自己排上場</span>
          </div>
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

        {/* 公開資訊:簡介 + 聯繫連結(同一張卡,臨打人都看得到) */}
        <div className="card space-y-2">
          <span className="font-bold text-gray-700">📣 團簡介與聯繫方式(選填)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="介紹一下你的團:程度、費用、注意事項…(例:進階團 4~6 級,一場 150,自備球拍)"
            rows={3}
            maxLength={300}
            className="w-full border-2 border-gray-200 rounded-2xl px-3 py-2 text-sm resize-none
              focus:outline-none focus:border-brand-pink"
          />
          <input
            value={contactUrl}
            onChange={(e) => setContactUrl(e.target.value)}
            placeholder="聯繫連結 https://line.me/..."
            inputMode="url"
            className="w-full border-2 border-gray-200 rounded-2xl px-3 py-2 text-sm
              focus:outline-none focus:border-brand-pink"
          />
          <span className="text-xs text-gray-400">臨打人在首頁會看到簡介和「聯繫團主」按鈕(可放 LINE 群、報名表等),開團後也能在「⚙️ 設定」改。</span>
        </div>

        {/* 前台報名(預設關,不影響密碼加入) */}
        <div className="card space-y-2">
          <label className="flex items-center justify-between">
            <span className="font-bold text-gray-700">🙋 開放前台報名</span>
            <input
              type="checkbox"
              checked={signupOpen}
              onChange={(e) => setSignupOpen(e.target.checked)}
              className="w-5 h-5 accent-pink-400"
            />
          </label>
          {signupOpen && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">收人名額</span>
              <input
                value={signupQuota}
                onChange={(e) => setSignupQuota(e.target.value)}
                placeholder="不限"
                inputMode="numeric"
                className="w-20 border-2 border-gray-200 rounded-2xl px-3 py-1.5 text-sm text-center
                  focus:outline-none focus:border-brand-pink"
              />
              <span className="text-xs text-gray-400">人(留空=不限;滿了還是可以報名,由你決定收誰)</span>
            </div>
          )}
          <span className="text-xs text-gray-400">
            臨打人可以直接在首頁報名、留言給你,你核准後才加入;知道密碼的人照樣直接進,不用審核。
          </span>
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        {atOpenLimit && (
          <p className="text-amber-600 text-sm text-center bg-amber-50 rounded-2xl py-2 px-3">
            已達同時開團上限({MAX_OPEN} 個),請先結束或關閉舊的團再開新的。
          </p>
        )}

        <button
          onClick={openSession}
          disabled={creating || atOpenLimit}
          className="btn-primary w-full text-lg py-4 disabled:opacity-40"
        >
          {creating ? '開團中...' : '🏸 開團'}
        </button>

        <div className="pt-2">
          <InstallButton label="📲 安裝後台到桌面" />
        </div>
      </div>
    </div>
  )
}
