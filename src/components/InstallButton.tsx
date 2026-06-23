import { useEffect, useState } from 'react'
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

export function InstallButton({ label = '📲 安裝到手機桌面' }: { label?: string }) {
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
        {label}
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
                  <p className="font-extrabold text-gray-800 text-lg">先用瀏覽器打開 🏸</p>
                  <p className="text-gray-600 text-sm">
                    你現在是用 App(FB / Messenger / IG / LINE)的內建瀏覽器,**沒辦法安裝**。
                    請改用 <b>Chrome</b> 或 <b>Safari</b> 開啟:
                  </p>
                  <ol className="text-gray-600 text-sm space-y-1.5 list-decimal list-inside">
                    <li>點畫面右上角的 <b>⋯</b>(或選單)</li>
                    <li>選<b>「用外部瀏覽器開啟」/「在 Chrome 開啟」</b></li>
                    <li>在那邊再點一次「安裝到桌面」</li>
                  </ol>
                  <button onClick={copyLink} className="btn-secondary w-full text-sm">
                    {copied ? '✓ 已複製網址' : '複製網址(去瀏覽器貼上)'}
                  </button>
                </>
              )}

              {help === 'ios' && (
                <>
                  <p className="font-extrabold text-gray-800 text-lg">在 iPhone 安裝 🏸</p>
                  <ol className="text-gray-600 text-sm space-y-2 list-decimal list-inside">
                    <li>用 <b>Safari</b> 開這個網站</li>
                    <li>點底部中間的<b>「分享」</b>鈕(方框加向上箭頭)</li>
                    <li>往下滑,點<b>「加入主畫面」</b></li>
                    <li>右上角點<b>「新增」</b></li>
                  </ol>
                </>
              )}

              {help === 'generic' && (
                <>
                  <p className="font-extrabold text-gray-800 text-lg">安裝到桌面 🏸</p>
                  <p className="text-gray-600 text-sm">
                    在瀏覽器選單(<b>⋮</b> 或分享鈕)找<b>「安裝應用程式」</b>或<b>「加到主畫面」</b>即可。
                  </p>
                </>
              )}

              <button onClick={() => setHelp(null)} className="btn-primary w-full">知道了</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
