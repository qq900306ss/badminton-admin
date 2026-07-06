import { useTranslation } from 'react-i18next'

// 24-hour time picker that looks the same on every device (no OS 12h/24h surprise)
export function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation()
  const [h = '18', m = '00'] = (value || '18:00').split(':')
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  const mins = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))
  const hh = Number(h)
  const set = (nh: string, nm: string) => onChange(`${nh}:${nm}`)

  const cls =
    'border-2 border-gray-200 rounded-2xl px-3 py-2.5 font-bold text-gray-700 bg-white focus:outline-none focus:border-brand-pink'

  return (
    <div className="mt-1 flex items-center gap-2">
      <select value={h} onChange={(e) => set(e.target.value, m)} className={cls}>
        {hours.map((x) => (
          <option key={x} value={x}>{x}</option>
        ))}
      </select>
      <span className="font-bold text-gray-400">:</span>
      <select value={mins.includes(m) ? m : '00'} onChange={(e) => set(h, e.target.value)} className={cls}>
        {mins.map((x) => (
          <option key={x} value={x}>{x}</option>
        ))}
      </select>
      <span className="text-sm text-gray-400">
        {hh < 6 ? t('TimeSelect.periodDawn') : hh < 12 ? t('TimeSelect.periodMorning') : hh < 18 ? t('TimeSelect.periodAfternoon') : t('TimeSelect.periodEvening')} {hh % 12 === 0 ? 12 : hh % 12} {t('TimeSelect.oClock')}
      </span>
    </div>
  )
}
