import { useEffect, useState } from 'react'
import { isUpdateAvailable, forceUpdate } from '../lib/appUpdate'

// Polls /version.json and, when a newer build is deployed, shows a banner so the
// leader KNOWS a new version exists (a manual refresh button alone isn't enough —
// they'd never know when to press it). Checks on mount, every 2 min, and whenever
// the tab regains focus (covers PWAs resumed from background).
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
    <div className="fixed bottom-0 inset-x-0 z-[80] bg-brand-pink text-white px-4 py-3 flex items-center justify-between gap-3 shadow-lg">
      <span className="text-sm font-bold">✨ 有新版本可以更新囉</span>
      <button
        onClick={() => forceUpdate()}
        className="bg-white text-brand-pink text-sm font-extrabold rounded-full px-4 py-1.5 shrink-0 active:scale-95"
      >
        立即更新
      </button>
    </div>
  )
}
