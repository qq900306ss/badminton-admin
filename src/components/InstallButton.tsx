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

export function InstallButton({ label = '📲 安裝到手機桌面' }: { label?: string }) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null)
  const [iosHelp, setIosHelp] = useState(false)
  const [installed, setInstalled] = useState(false)

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)

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

  if (installed) return null // already installed — nothing to do
  if (!deferred && !isIos) return null // no install path on this browser

  async function install() {
    if (deferred) {
      await deferred.prompt()
      setDeferred(null)
    } else {
      setIosHelp(true)
    }
  }

  return (
    <>
      <button
        onClick={install}
        className="w-full bg-white border-2 border-brand-pink text-brand-pink font-bold
          py-2.5 rounded-2xl shadow-sm active:scale-95 transition-transform"
      >
        {isIos ? '📲 加到主畫面(像 App 一樣用)' : label}
      </button>

      <AnimatePresence>
        {iosHelp && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIosHelp(false)}
          >
            <motion.div
              className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 space-y-3"
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="font-extrabold text-gray-800 text-lg">在 iPhone 安裝 🏸</p>
              <ol className="text-gray-600 text-sm space-y-2 list-decimal list-inside">
                <li>用 <b>Safari</b> 開這個網站</li>
                <li>點底部中間的<b>「分享」</b>鈕(方框加向上箭頭 􀈂)</li>
                <li>往下滑,點<b>「加入主畫面」</b></li>
                <li>右上角點<b>「新增」</b></li>
              </ol>
              <p className="text-xs text-gray-400">裝好後從桌面那個圖示打開,就能收到「輪到你了」通知。</p>
              <button onClick={() => setIosHelp(false)} className="btn-primary w-full">知道了</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
