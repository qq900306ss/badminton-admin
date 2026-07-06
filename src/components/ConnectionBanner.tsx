import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'

// Shows a thin banner when polling/requests are failing (flaky venue wifi),
// so a stuck-looking screen reads as "reconnecting", not "frozen".
export function ConnectionBanner() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [down, setDown] = useState(false)

  useEffect(() => {
    const offline = () => setDown(true)
    window.addEventListener('offline', offline)

    const unsub = qc.getQueryCache().subscribe((event) => {
      const action = (event as { action?: { type?: string; error?: unknown } })?.action
      if (action?.type === 'error') {
        // only treat genuine network failures as "連線不穩" — a 401/404/500 has a
        // response and means a data/auth problem, not a flaky connection
        const hasResponse = !!(action.error as { response?: unknown })?.response
        if (!hasResponse) setDown(true)
      } else if (action?.type === 'success') {
        setDown(false)
      }
    })

    return () => {
      window.removeEventListener('offline', offline)
      unsub()
    }
  }, [qc])

  if (!down) return null
  return (
    <div className="fixed top-0 inset-x-0 z-[70] bg-amber-400 text-amber-900 text-center text-xs font-bold py-1.5">
      {t('ConnectionBanner.reconnecting')}
    </div>
  )
}
