import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'

type BIPEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: string }>
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

type Help = null | 'ios' | 'inapp' | 'generic'

export function InstallButton({ label }: { label?: string }) {
  const { t } = useTranslation()
  const [deferred, setDeferred] = useState<BIPEvent | null>(null)
  const [help, setHelp] = useState<Help>(null)
  const [installed, setInstalled] = useState(false)
  const [copied, setCopied] = useState(false)

  const ua = navigator.userAgent || ''
  const isIos = /iphone|ipad|ipod/i.test(ua)
  // in-app browsers (FB / Messenger / IG / LINE / WeChat …) can't install PWAs
  const isInApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|Messenger|MicroMessenger|Twitter|musical_ly|Snapchat/i.test(ua)

  useEffect(() => {
    if (isStandalone()) setInstalled(true)
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BIPEvent)
    }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return null

  async function onClick() {
    if (deferred) {
      await deferred.prompt()
      setDeferred(null)
      return
    }
    setHelp(isInApp ? 'inapp' : isIos ? 'ios' : 'generic')
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <button
        onClick={onClick}
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
