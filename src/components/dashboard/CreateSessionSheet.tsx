import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { sessionApi, type Org, type SessionSummary } from '../../api/client'
import { Sheet } from '../manage/Sheet'
import { TimeSelect } from '../TimeSelect'
import { TW_CITIES } from '../../lib/twCities'
import { TW_DISTRICTS } from '../../lib/twDistricts'

// 開新團的表單(底部抽屜)。可以帶「上一團」進來 → 名稱、地點、場地數、時段、簡介、報名設定都照抄,
// 團主多半每週同一時段開同一團,只要改日期(和密碼)就能開。

const MAX_OPEN = 7 // 與後端 maxOpenPerOrg 一致

const localDate = (d: Date) => d.toLocaleDateString('en-CA') // YYYY-MM-DD(本地時區)
const hm = (iso?: string, fallback = '18:00') => {
  if (!iso) return fallback
  const d = new Date(iso)
  return isNaN(d.getTime()) ? fallback : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function toISO(date: string, time: string): string | undefined {
  if (!date || !time) return undefined
  const d = new Date(`${date}T${time}`)
  return isNaN(d.getTime()) ? undefined : d.toISOString()
}
// 「照上一團」預設日期:上一團的下一個同星期幾(今天就是那天且時間還沒過 → 今天)
function nextSameWeekday(prevStart?: string): string {
  const today = new Date()
  if (!prevStart) return localDate(today)
  const wd = new Date(prevStart).getDay()
  const d = new Date(today)
  const add = (wd - today.getDay() + 7) % 7
  d.setDate(today.getDate() + add)
  return localDate(d)
}
const randomCode = () => String(Math.floor(100000 + Math.random() * 900000))

export function CreateSessionSheet({
  open,
  onClose,
  org,
  from,
  fromPassword,
  openCount,
}: {
  open: boolean
  onClose: () => void
  org: Org | null
  from?: SessionSummary // 照這一團再開
  fromPassword?: string
  openCount: number
}) {
  const { t } = useTranslation()
  const nav = useNavigate()
  const [title, setTitle] = useState(from?.title ?? '')
  const [city, setCity] = useState(from?.city ?? '台中市')
  const [district, setDistrict] = useState(from?.district ?? '')
  const [password, setPassword] = useState(fromPassword ?? '')
  const [numCourts, setNumCourts] = useState(from?.num_courts ?? 4)
  const [date, setDate] = useState(from ? nextSameWeekday(from.start_at) : localDate(new Date()))
  const [startTime, setStartTime] = useState(hm(from?.start_at, '18:00'))
  const [endTime, setEndTime] = useState(hm(from?.end_at, '21:00'))
  const [queueTime, setQueueTime] = useState(hm(from?.queue_open_at ?? from?.start_at, '18:00'))
  const [contactUrl, setContactUrl] = useState(from?.contact_url ?? '')
  const [description, setDescription] = useState(from?.description ?? '')
  const [signupOpen, setSignupOpen] = useState(!!from?.signup_open)
  const [signupQuota, setSignupQuota] = useState(from?.signup_quota ? String(from.signup_quota) : '')
  const [more, setMore] = useState(!!(from?.description || from?.contact_url || from?.signup_open))
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const atLimit = openCount >= MAX_OPEN

  // 開抽屜那一刻的今天/明天(render 保持純)
  const [{ today, tomorrow }] = useState(() => {
    const d = new Date()
    const n = new Date(d)
    n.setDate(d.getDate() + 1)
    return { today: localDate(d), tomorrow: localDate(n) }
  })
  const weekday = (d: string) => new Date(`${d}T12:00`).toLocaleDateString('zh-TW', { weekday: 'short' })

  async function submit() {
    if (!password.trim()) return setError(t('DashboardPage.courtPasswordRequired'))
    if (!district.trim()) return setError(t('DashboardPage.districtRequired'))
    const contact = contactUrl.trim()
    if (contact && !/^https?:\/\//.test(contact)) return setError(t('DashboardPage.contactUrlInvalid'))
    const desc = description.trim()
    if ([...desc].length > 300) return setError(t('DashboardPage.descTooLong'))
    const quota = signupQuota.trim() === '' ? 0 : Number(signupQuota)
    if (!Number.isInteger(quota) || quota < 0 || quota > 200) return setError(t('DashboardPage.quotaInvalid'))
    setCreating(true)
    setError('')
    try {
      const res = await sessionApi.create({
        title: title.trim() || org?.org_name || t('DashboardPage.defaultTeamName'),
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
      setError(msg ?? t('DashboardPage.createFailed'))
    } finally {
      setCreating(false)
    }
  }

  const field = 'w-full border-2 border-gray-100 bg-gray-50 rounded-2xl px-3 py-2.5 text-[15px] focus:outline-none focus:border-brand-pink focus:bg-white'
  const label = 'block text-xs font-bold text-gray-400 mb-1'
  const section = 'space-y-3 py-4 border-b border-gray-100 last:border-0'

  return (
    <Sheet open={open} onClose={onClose} title={from ? t('Home.repeatTitle', { name: from.title || t('DashboardPage.untitled') }) : t('Home.newTitle')}>
      <div className="-mt-2">
        {/* 基本 */}
        <div className={section}>
          <div>
            <span className={label}>{t('DashboardPage.sessionNameLabel')}</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={org?.org_name || t('DashboardPage.sessionNamePlaceholder')} maxLength={20} className={field} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className={label}>{t('DashboardPage.cityLabel')}</span>
              <select
                value={city}
                onChange={(e) => {
                  setCity(e.target.value)
                  setDistrict('')
                }}
                className={field}
              >
                {TW_CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className={label}>{t('DashboardPage.districtLabel')}</span>
              {TW_DISTRICTS[city] ? (
                <select value={district} onChange={(e) => setDistrict(e.target.value)} className={field}>
                  <option value="">{t('DashboardPage.selectDistrict')}</option>
                  {TW_DISTRICTS[city].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              ) : (
                <input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder={t('DashboardPage.districtPlaceholder')} className={field} />
              )}
            </div>
          </div>
        </div>

        {/* 時間 */}
        <div className={section}>
          <div>
            <span className={label}>{t('DashboardPage.dateLabel')}</span>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { v: today, l: t('Home.today') },
                { v: tomorrow, l: t('Home.tomorrow') },
              ].map((o) => (
                <button key={o.v} onClick={() => setDate(o.v)} className={`px-3.5 py-2 rounded-full text-sm font-bold ${date === o.v ? 'bg-pink-400 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {o.l}
                </button>
              ))}
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`px-3 py-1.5 rounded-full text-sm font-bold border-2 ${date !== today && date !== tomorrow ? 'border-pink-400 text-pink-500' : 'border-gray-100 text-gray-500'}`}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {date.replaceAll('-', '/')}({weekday(date)})
            </p>
          </div>
          <div className="space-y-2">
            <div>
              <span className={label}>{t('DashboardPage.startTimeLabel')}</span>
              <TimeSelect
                value={startTime}
                onChange={(v) => {
                  // 開放排隊時間原本跟開打一樣 → 跟著改
                  if (queueTime === startTime) setQueueTime(v)
                  setStartTime(v)
                }}
              />
            </div>
            <div>
              <span className={label}>{t('DashboardPage.endTimeLabel')}</span>
              <TimeSelect value={endTime} onChange={setEndTime} />
            </div>
          </div>
        </div>

        {/* 場地 + 密碼 */}
        <div className={section}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-700">{t('DashboardPage.numCourtsLabel')}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setNumCourts(Math.max(1, numCourts - 1))} className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 text-xl font-bold active:scale-90">
                −
              </button>
              <span className="w-10 text-center text-2xl font-extrabold tabular-nums">{numCourts}</span>
              <button onClick={() => setNumCourts(Math.min(30, numCourts + 1))} className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 text-xl font-bold active:scale-90">
                ＋
              </button>
            </div>
          </div>
          <div>
            <span className={label}>{t('DashboardPage.passwordLabel')}</span>
            <div className="flex gap-2">
              <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('DashboardPage.passwordPlaceholder')} inputMode="numeric" className={`${field} tracking-widest font-bold`} />
              <button onClick={() => setPassword(randomCode())} className="shrink-0 px-3 rounded-2xl bg-gray-100 text-sm font-bold text-gray-600" title={t('Home.randomCode')}>
                🎲
              </button>
            </div>
          </div>
        </div>

        {/* 進階 */}
        <div className={section}>
          <button onClick={() => setMore((v) => !v)} className="w-full flex items-center justify-between text-sm font-bold text-gray-700">
            <span>{t('Home.moreOptions')}</span>
            <span className="text-gray-300">{more ? '−' : '＋'}</span>
          </button>
          {more && (
            <>
              <div>
                <span className={label}>{t('DashboardPage.queueTimeLabel')}</span>
                <TimeSelect value={queueTime} onChange={setQueueTime} />
                <span className="text-[11px] text-gray-400">{t('DashboardPage.queueTimeHint')}</span>
              </div>
              <div>
                <span className={label}>{t('DashboardPage.introTitle')}</span>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('DashboardPage.descPlaceholder')} rows={3} maxLength={300} className={`${field} resize-none text-sm`} />
                <input value={contactUrl} onChange={(e) => setContactUrl(e.target.value)} placeholder={t('DashboardPage.contactPlaceholder')} inputMode="url" className={`${field} text-sm mt-2`} />
                <span className="text-[11px] text-gray-400">{t('DashboardPage.contactHint')}</span>
              </div>
              <label className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-700">{t('DashboardPage.signupToggle')}</span>
                <input type="checkbox" checked={signupOpen} onChange={(e) => setSignupOpen(e.target.checked)} className="w-6 h-6 accent-pink-400" />
              </label>
              {signupOpen && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">{t('DashboardPage.quotaLabel')}</span>
                  <input value={signupQuota} onChange={(e) => setSignupQuota(e.target.value)} placeholder={t('DashboardPage.unlimited')} inputMode="numeric" className="w-20 border-2 border-gray-100 bg-gray-50 rounded-2xl px-3 py-1.5 text-sm text-center focus:outline-none focus:border-brand-pink" />
                  <span className="text-[11px] text-gray-400">{t('DashboardPage.quotaHint')}</span>
                </div>
              )}
              <span className="block text-[11px] text-gray-400">{t('DashboardPage.signupHint')}</span>
            </>
          )}
        </div>

        {/* 開團(固定在抽屜底部) */}
        <div className="sticky bottom-0 -mx-5 px-5 pt-3 pb-1 bg-white">
          {error && <p className="text-red-500 text-sm text-center mb-2">{error}</p>}
          {atLimit && <p className="text-amber-600 text-xs text-center bg-amber-50 rounded-2xl py-2 px-3 mb-2">{t('DashboardPage.atOpenLimit', { max: MAX_OPEN })}</p>}
          <button onClick={submit} disabled={creating || atLimit} className="w-full py-4 rounded-2xl bg-pink-400 text-white text-lg font-extrabold active:scale-[0.99] disabled:bg-gray-200 disabled:text-gray-400">
            {creating ? t('DashboardPage.creating') : t('Home.openNow', { date: `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`, time: startTime })}
          </button>
        </div>
      </div>
    </Sheet>
  )
}
