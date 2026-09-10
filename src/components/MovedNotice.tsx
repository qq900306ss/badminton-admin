import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

// 網址搬家(cloudfront.net → 自訂網域)的收尾:舊 origin 開到這裡時 —
//   一般瀏覽器 → 直接跳到新網域同一路徑(等同 301,舊連結都還能用)
//   已安裝的 PWA(standalone)→ 不能偷跳:跨 origin 會跑出 scope 變成有網址列的降級畫面,
//     而且桌面那顆圖示永遠指舊 origin。改成全螢幕提醒「請到新網址重新安裝」,可稍後(本次不再吵)
// 只認得「已知的舊 host」才動作,localhost / 預覽環境不受影響。
const CANONICAL_HOST = (import.meta.env.VITE_CANONICAL_HOST as string | undefined) || 'host.badminton-tw.fyi'

function isLegacyHost(host: string): boolean {
  if (host === CANONICAL_HOST) return false
  return /\.cloudfront\.net$/i.test(host)
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export function MovedNotice() {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('moved_notice_later') === '1')
  const [copied, setCopied] = useState(false)
  const legacy = isLegacyHost(window.location.hostname)
  const standalone = isStandalone()
  const target = `https://${CANONICAL_HOST}${window.location.pathname}${window.location.search}${window.location.hash}`
  const newUrl = `https://${CANONICAL_HOST}/`

  useEffect(() => {
    if (legacy && !standalone) window.location.replace(target)
  }, [legacy, standalone, target])

  if (!legacy || !standalone || dismissed) return null

  async function copy() {
    try {
      await navigator.clipboard.writeText(newUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* 網址就在畫面上,可以自己選 */
    }
  }

  return (
    <div className="fixed inset-0 z-[90] bg-black/50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4">
        <div className="text-4xl">🚚</div>
        <p className="font-extrabold text-gray-800 text-lg">{t('MovedNotice.title')}</p>
        <p className="text-sm text-gray-600">{t('MovedNotice.body')}</p>
        <div className="bg-gray-50 rounded-xl px-3 py-2 text-xs text-gray-500 break-all select-all">{newUrl}</div>
        <a href={newUrl} target="_blank" rel="noopener noreferrer" className="btn-primary block text-center">
          {t('MovedNotice.open')}
        </a>
        <button onClick={copy} className="btn-secondary w-full text-sm">
          {copied ? `✓ ${t('MovedNotice.copied')}` : t('MovedNotice.copy')}
        </button>
        <p className="text-[11px] text-gray-400">{t('MovedNotice.hint')}</p>
        <button
          onClick={() => {
            sessionStorage.setItem('moved_notice_later', '1')
            setDismissed(true)
          }}
          className="w-full text-sm font-bold text-gray-400"
        >
          {t('MovedNotice.later')}
        </button>
      </div>
    </div>
  )
}
