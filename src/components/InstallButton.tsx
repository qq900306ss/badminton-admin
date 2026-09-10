import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { useInstallPrompt, promptInstall, isStandalone } from '../lib/installPrompt'

type Help = null | 'ios' | 'inapp' | 'generic'

// 被「舊網址的 PWA」開著:?moved=1(MovedNotice 帶的)或 referrer 是舊 host 且還是 standalone。
// 那個視窗是舊 App 的(display-mode 也報 standalone),裝不了新的、也不能當「已裝好」把按鈕藏起來。
const LEGACY_HOSTS = ['d1r9u0ja59y4rv.cloudfront.net']
function isOpenedFromOldApp(): boolean {
  if (new URLSearchParams(window.location.search).get('moved') === '1') return true
  if (!isStandalone()) return false
  try {
    return LEGACY_HOSTS.includes(new URL(document.referrer).hostname.toLowerCase())
  } catch {
    return false
  }
}

export function InstallButton({ label }: { label?: string }) {
  const { t } = useTranslation()
  const { hasPrompt, installed, installedHere } = useInstallPrompt()
  const [fromOldApp] = useState(() => isOpenedFromOldApp())
  const [help, setHelp] = useState<Help>(null)
  const [copied, setCopied] = useState(false)

  const ua = navigator.userAgent || ''
  const isIos = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isAndroid = /android/i.test(ua)
  // in-app browsers (FB / Messenger / IG / LINE / WeChat / 一般 WebView …) can't install PWAs
  const isInApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|Messenger|MicroMessenger|Twitter|musical_ly|Snapchat|; wv\)/i.test(ua)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/login`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  // 優先序:有原生安裝框(只有真瀏覽器分頁會發)→ 安裝鈕;本頁剛裝好 → 藏;
  // 被舊 App 開著 → 出口說明(不能藏,不然人卡在那個視窗);standalone → 藏;其他 → 鈕+說明
  if (hasPrompt) {
    return (
      <button
        onClick={() => promptInstall()}
        className="w-full bg-white border-2 border-brand-pink text-brand-pink font-bold
          py-2.5 rounded-2xl shadow-sm active:scale-95 transition-transform"
      >
        {label ?? t('InstallButton.installLabel')}
      </button>
    )
  }
  if (installedHere) return null
  if (fromOldApp) {
    return (
      <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-3 text-left space-y-2">
        <p className="text-sm font-bold text-amber-800">{t('InstallButton.oldappTitle')}</p>
        <p className="text-xs text-amber-700">
          {isIos ? t('InstallButton.oldappIos') : isAndroid ? t('InstallButton.oldappAndroid') : t('InstallButton.oldappOther')}
        </p>
        <button onClick={copyLink} className="btn-secondary w-full text-sm">
          {copied ? t('InstallButton.copied') : t('InstallButton.copyLink')}
        </button>
      </div>
    )
  }
  if (installed) return null

  return (
    <>
      <button
        onClick={() => setHelp(isInApp ? 'inapp' : isIos ? 'ios' : 'generic')}
        className="w-full bg-white border-2 border-brand-pink text-brand-pink font-bold
          py-2.5 rounded-2xl shadow-sm active:scale-95 transition-transform"
      >
        {label ?? t('InstallButton.installLabel')}
      </button>

      <AnimatePresence>
        {help && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setHelp(null)}
          >
            <motion.div
              className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 space-y-3"
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
            >
              {help === 'inapp' && (
                <>
                  <p className="font-extrabold text-gray-800 text-lg">{t('InstallButton.inappTitle')}</p>
                  <p className="text-gray-600 text-sm">
                    {t('InstallButton.inappBody1')}<b>Chrome</b>{t('InstallButton.inappBodyOr')}<b>Safari</b>{t('InstallButton.inappBody2')}
                  </p>
                  <ol className="text-gray-600 text-sm space-y-1.5 list-decimal list-inside">
                    <li>{t('InstallButton.inappStep1a')}<b>⋯</b>{t('InstallButton.inappStep1b')}</li>
                    <li>{t('InstallButton.inappStep2a')}<b>{t('InstallButton.inappStep2b')}</b>{t('InstallButton.inappStep2c')}</li>
                    <li>{t('InstallButton.inappStep3')}</li>
                  </ol>
                  <button onClick={copyLink} className="btn-secondary w-full text-sm">
                    {copied ? t('InstallButton.copied') : t('InstallButton.copyLink')}
                  </button>
                </>
              )}

              {help === 'ios' && (
                <>
                  <p className="font-extrabold text-gray-800 text-lg">{t('InstallButton.iosTitle')}</p>
                  <ol className="text-gray-600 text-sm space-y-2 list-decimal list-inside">
                    <li>{t('InstallButton.iosStep1a')}<b>Safari</b>{t('InstallButton.iosStep1b')}</li>
                    <li>{t('InstallButton.iosStep2a')}<b>{t('InstallButton.iosStep2b')}</b>{t('InstallButton.iosStep2c')}</li>
                    <li>{t('InstallButton.iosStep3a')}<b>{t('InstallButton.iosStep3b')}</b>{t('InstallButton.iosStep3c')}</li>
                    <li>{t('InstallButton.iosStep4a')}<b>{t('InstallButton.iosStep4b')}</b>{t('InstallButton.iosStep4c')}</li>
                  </ol>
                </>
              )}

              {help === 'generic' && (
                <>
                  <p className="font-extrabold text-gray-800 text-lg">{t('InstallButton.genericTitle')}</p>
                  <p className="text-gray-600 text-sm">
                    {t('InstallButton.genericA')}<b>⋮</b>{t('InstallButton.genericB')}<b>{t('InstallButton.genericInstallApp')}</b>{t('InstallButton.genericOr')}<b>{t('InstallButton.genericAddHome')}</b>{t('InstallButton.genericEnd')}
                  </p>
                </>
              )}

              <button onClick={() => setHelp(null)} className="btn-primary w-full">{t('InstallButton.gotIt')}</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
