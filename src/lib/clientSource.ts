import type { TFunction } from 'i18next'

// 玩家從哪個平台來(後端從前台的 X-Client 標頭記下來):
//   ios-app/<版本>(<build>)  App Store 的 iOS App(例:ios-app/1.0.0(1))
//   android-app              Google Play 的 Android App(TWA)
//   pwa                      從瀏覽器「加入主畫面」開的
//   web                      一般瀏覽器
// 舊帳號 / 舊版前台沒帶 → 未知。會員管理、意見回饋、檢舉共用這一份解析跟顯示文字。
export type ClientPlatform = 'ios' | 'android' | 'pwa' | 'web' | 'unknown'

export interface ClientInfo {
  platform: ClientPlatform
  version?: string // 只有 iOS App 有:1.0.0(build 號不顯示)
}

export const CLIENT_PLATFORMS: ClientPlatform[] = ['ios', 'android', 'pwa', 'web', 'unknown']

const EMOJI: Record<ClientPlatform, string> = {
  ios: '🍎',
  android: '🤖',
  pwa: '📱',
  web: '🌐',
  unknown: '—',
}

export function parseClient(raw?: string | null): ClientInfo {
  const s = (raw ?? '').trim()
  const m = s.match(/^ios-app(?:\/([^(\s]+))?/)
  if (m) return { platform: 'ios', version: m[1] }
  if (s.startsWith('android-app')) return { platform: 'android' }
  if (s === 'pwa' || s.startsWith('pwa/')) return { platform: 'pwa' }
  if (s === 'web' || s.startsWith('web/')) return { platform: 'web' }
  return { platform: 'unknown' }
}

// 平台名稱(不含 emoji、不含版本),給統計列用
export function platformName(p: ClientPlatform, t: TFunction): string {
  return t(`ClientSource.${p}`)
}

// 「🍎 iOS App 1.0.0」這種完整標籤,給徽章用
export function clientLabel(info: ClientInfo, t: TFunction): string {
  const name = platformName(info.platform, t)
  const version = info.version ? ` ${info.version}` : ''
  return `${EMOJI[info.platform]} ${name}${version}`
}

export function platformEmoji(p: ClientPlatform): string {
  return EMOJI[p]
}
