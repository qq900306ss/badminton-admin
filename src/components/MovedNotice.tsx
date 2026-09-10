import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

// 網址搬家(cloudfront.net → 自訂網域)的收尾:舊 origin 開到這裡時 —
//   一般瀏覽器 → 直接跳到新網域同一路徑(等同 301,舊連結都還能用)
//   已安裝的 PWA(standalone)→ 不能偷跳:跨 origin 會跑出 scope 變成有網址列的降級畫面,
//     而且桌面那顆圖示永遠指舊 origin。改成全螢幕提醒「請到新網址重新安裝」,可稍後(本次不再吵)
// 只認得「已知的舊 host」才動作(明確列舉,不用 *.cloudfront.net 通配——其他 CloudFront 預覽環境不該被踢去正式站)。
const CANONICAL_HOST = (import.meta.env.VITE_CANONICAL_HOST as string | undefined) || 'host.badminton-tw.fyi'
const LEGACY_HOSTS = ['d1r9u0ja59y4rv.cloudfront.net']

function isLegacyHost(host: string): boolean {
  if (host === CANONICAL_HOST) return false
  return LEGACY_HOSTS.includes(host.toLowerCase())
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

// storage 被瀏覽器禁掉(隱私模式/設定)會直接 throw,這裡不能讓它炸到 ErrorBoundary
const LATER_KEY = 'moved_notice_later'
function readLater(): boolean {
  try {
    return sessionStorage.getItem(LATER_KEY) === '1'
  } catch {
    return false
  }
}
function writeLater() {
  try {
    sessionStorage.setItem(LATER_KEY, '1')
  } catch {
    /* 存不了就只是下次開啟再提醒一次 */
  }
}

export function MovedNotice() {
  const { t } = useTranslation()
  const legacy = isLegacyHost(window.location.hostname)
  const standalone = isStandalone()
  // 只有真的要顯示時才碰 storage
  const [dismissed, setDismissed] = useState(() => legacy && standalone && readLater())
  const [copied, setCopied] = useState(false)
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
    // z-[55]:壓在頁面上,但低於 LanguageSwitcher(60)—— 提醒顯示時還能切語言;卡片置中避開左下角的語言鈕
    <div className="fixed inset-0 z-[55] bg-black/50 flex items-center justify-center p-4 pb-20">
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
            writeLater()
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
