import type { TFunction } from 'i18next'
import type { AdminPlayer, PlayerStats, SessionSummary } from '../../api/client'

// 超級後台各分頁共用的格式化與判斷

export const DAY = 86_400_000

// 列表時間:月/日 時:分
export const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

export const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

export function fmtRange(s: { start_at?: string; end_at?: string }): string {
  if (!s.start_at) return ''
  const start = new Date(s.start_at)
  const hm = (d: Date) => d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
  const day = `${start.getMonth() + 1}/${start.getDate()}`
  const tail = s.end_at ? `–${hm(new Date(s.end_at))}` : ''
  return `${day} ${hm(start)}${tail}`
}

// 「3 天前」「2 個月前」;未來時間顯示「x 天後」
export function ago(iso: string | undefined, now: number, t: TFunction): string {
  if (!iso) return t('AdminConsole.never')
  const diff = now - new Date(iso).getTime()
  const abs = Math.abs(diff)
  const future = diff < 0
  const unit = (key: string, n: number) => t(future ? `AdminConsole.in_${key}` : `AdminConsole.ago_${key}`, { count: n })
  if (abs < 3_600_000) return future ? unit('min', Math.max(1, Math.round(abs / 60_000))) : t('AdminConsole.justNow')
  if (abs < DAY) return unit('hour', Math.round(abs / 3_600_000))
  if (abs < 30 * DAY) return unit('day', Math.round(abs / DAY))
  if (abs < 365 * DAY) return unit('month', Math.round(abs / (30 * DAY)))
  return unit('year', Math.round(abs / (365 * DAY)))
}

export const fmtMinutes = (m: number, t: TFunction) =>
  m >= 60 ? t('AdminConsole.hoursMinutes', { h: Math.floor(m / 60), m: m % 60 }) : t('AdminConsole.minutesOnly', { m })

export type SessionState = 'ongoing' | 'upcoming' | 'closed'

// 尚未開始 = open 但開打時間還沒到;進行中 = open 且已到時段
export function sessionState(s: SessionSummary, now: number): SessionState {
  if (s.status !== 'open') return 'closed'
  return s.start_at && new Date(s.start_at).getTime() > now ? 'upcoming' : 'ongoing'
}

export const PROVIDER_LABEL: Record<'google' | 'line' | 'apple', string> = { google: 'Google', line: 'LINE', apple: 'Apple' }

// 最近活動 = 「最近使用 App」與「最近加入的團」較晚者;舊帳號兩者都沒有就用註冊時間
export function lastActiveOf(p: AdminPlayer, st?: PlayerStats): string {
  const xs = [p.last_seen_at, st?.last_session_at].filter(Boolean) as string[]
  return xs.sort().pop() ?? p.created_at
}

export const errMsg = (e: unknown) => (e as { response?: { data?: { error?: string } } })?.response?.data?.error

// 長列表一次只畫一段,按「顯示更多」再加
export const PAGE = 60
