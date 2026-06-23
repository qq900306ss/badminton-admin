import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

// Shows a thin banner when polling/requests are failing (flaky venue wifi),
// so a stuck-looking screen reads as "reconnecting", not "frozen".
export function ConnectionBanner() {
  const qc = useQueryClient()
  const [down, setDown] = useState(false)

  useEffect(() => {
    const offline = () => setDown(true)
    window.addEventListener('offline', offline)

    const unsub = qc.getQueryCache().subscribe((event) => {
      const t = (event as { action?: { type?: string } })?.action?.type
      if (t === 'error') setDown(true)
      else if (t === 'success') setDown(false)
    })

    return () => {
      window.removeEventListener('offline', offline)
      unsub()
    }
  }, [qc])

  if (!down) return null
  return (
    <div className="fixed top-0 inset-x-0 z-[70] bg-amber-400 text-amber-900 text-center text-xs font-bold py-1.5">
      📶 連線不穩,重新連線中…
    </div>
  )
}
