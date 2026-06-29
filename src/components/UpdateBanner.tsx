import { useEffect, useState } from 'react'
import { isUpdateAvailable, forceUpdate } from '../lib/appUpdate'

// Polls /version.json and, when a newer build is deployed, shows a prominent
// banner so the user KNOWS a new version exists and is nudged to update. Checks
// on mount, every 2 min, and whenever the tab regains focus (PWAs resumed from
// background).
export function UpdateBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    let alive = true
    const check = async () => {
      if (alive && (await isUpdateAvailable())) setShow(true)
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
    <div className="fixed top-0 inset-x-0 z-[90] px-3 py-3 bg-gradient-to-r from-brand-pink to-amber-400
      text-white shadow-xl flex items-center justify-center gap-3">
      <span className="text-sm sm:text-base font-extrabold animate-pulse">✨ 有新版本可以用囉!</span>
      <button
        onClick={() => forceUpdate()}
        className="relative bg-white text-brand-pink text-sm font-extrabold rounded-full
          px-5 py-2 shadow active:scale-95"
      >
        {/* pulsing ring to draw the eye */}
        <span className="absolute inset-0 rounded-full ring-2 ring-white/70 animate-ping" />
        🔄 立即更新
      </button>
    </div>
  )
}
