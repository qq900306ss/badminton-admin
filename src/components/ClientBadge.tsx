import { useTranslation } from 'react-i18next'
import { clientLabel, parseClient, type ClientPlatform } from '../lib/clientSource'

const STYLE: Record<ClientPlatform, string> = {
  ios: 'bg-gray-100 text-gray-700',
  android: 'bg-brand-mint text-emerald-700',
  pwa: 'bg-brand-lavender/60 text-violet-600',
  web: 'bg-sky-100 text-sky-700',
  unknown: 'bg-gray-50 text-gray-400',
}

// 來源平台小徽章(會員管理、意見回饋、檢舉共用)。hideUnknown:沒帶來源時整個不顯示
export function ClientBadge({ client, hideUnknown = false }: { client?: string; hideUnknown?: boolean }) {
  const { t } = useTranslation()
  const info = parseClient(client)
  if (hideUnknown && info.platform === 'unknown') return null
  return (
    <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${STYLE[info.platform]}`}>
      {clientLabel(info, t)}
    </span>
  )
}
