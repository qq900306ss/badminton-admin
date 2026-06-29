import { useEffect, useRef, useState } from 'react'
import { isUpdateAvailable, forceUpdate } from '../lib/appUpdate'

// Polls /version.json and, when a newer build is deployed, pops a centered modal
// so the user clearly sees there's an update and can apply it. Checks on mount,
// every 2 min, and whenever the tab regains focus (PWA resumed from background).
export function UpdateBanner() {
  const [show, setShow] = useState(false)
  const dismissed = useRef(false) // "稍後" suppresses re-nagging for this session

  useEffect(() => {
    let alive = true
    const check = async () => {
      if (alive && !dismissed.current && (await isUpdateAvailable())) setShow(true)
    }
    check()
    const id = setInterval(check, 120000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  if (!show) return null
  return (
    <div className="fixed inset-0 z-[95] bg-black/40 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl p-6 w-full max-w-xs text-center space-y-4 shadow-2xl">
        <div className="w-16 h-16 mx-auto rounded-full border-4 border-brand-pink/40 flex items-center justify-center text-3xl">
          ✨
        </div>
        <div className="space-y-1">
          <p className="text-lg font-extrabold text-gray-800">有新版本囉!</p>
          <p className="text-sm text-gray-500">更新一下就能用到最新功能與修正 🎉</p>
        </div>
        <button onClick={() => forceUpdate()} className="btn-primary w-full">
          🔄 立即更新
        </button>
        <button
          onClick={() => {
            dismissed.current = true
            setShow(false)
          }}
          className="text-xs text-gray-400"
        >
          稍後再說
        </button>
      </div>
    </div>
  )
}
