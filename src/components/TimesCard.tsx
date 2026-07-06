import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { sessionApi } from '../api/client'
import i18n from '../i18n'

// ISO → value for <input type="datetime-local"> (local wall-clock, "YYYY-MM-DDTHH:mm")
function toLocalInput(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tz).toISOString().slice(0, 16)
}
// datetime-local value (local) → ISO (UTC), '' stays ''
function fromLocalInput(v: string): string {
  if (!v) return ''
  const d = new Date(v)
  return isNaN(d.getTime()) ? '' : d.toISOString()
}
// "6/29 18:00" for display
function fmt(iso?: string): string {
  if (!iso) return i18n.t('TimesCard.notSet')
  const d = new Date(iso)
  if (isNaN(d.getTime())) return i18n.t('TimesCard.notSet')
  const hm = d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${d.getMonth() + 1}/${d.getDate()} ${hm}`
}

interface Props {
  sessionId: string
  startAt?: string
  endAt?: string
  queueOpenAt?: string
}

// Leader-only: view + edit the play window and when self-queue opens — same
// card pattern as the password card.
export function TimesCard({ sessionId, startAt, endAt, queueOpenAt }: Props) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [queue, setQueue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  function startEdit() {
    setStart(toLocalInput(startAt))
    setEnd(toLocalInput(endAt))
    setQueue(toLocalInput(queueOpenAt))
    setError('')
    setSaved(false)
    setEditing(true)
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      await sessionApi.setTimes(sessionId, {
        start_at: fromLocalInput(start),
        end_at: fromLocalInput(end),
        queue_open_at: fromLocalInput(queue),
      })
      qc.invalidateQueries({ queryKey: ['session', sessionId] })
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? t('TimesCard.errUpdateFailed'))
    } finally {
      setSaving(false)
    }
  }

  const field = (label: string, value: string, set: (v: string) => void) => (
    <label className="block">
      <span className="text-xs font-bold text-gray-500">{label}</span>
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => set(e.target.value)}
        className="mt-1 w-full border-2 border-gray-200 rounded-2xl px-3 py-2 text-sm
          focus:outline-none focus:border-brand-pink"
      />
    </label>
  )

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-bold text-gray-700">{t('TimesCard.heading')}</span>
        {saved && <span className="text-xs font-bold text-emerald-600">{t('TimesCard.updated')}</span>}
      </div>

      {!editing ? (
        <div className="flex items-center gap-3">
          <div className="flex-1 text-sm text-gray-600 space-y-0.5">
            <div>{t('TimesCard.playLabel')}<span className="font-bold">{fmt(startAt)}</span>{endAt ? ` – ${fmt(endAt)}` : ''}</div>
            <div>{t('TimesCard.queueLabel')}<span className="font-bold">{fmt(queueOpenAt)}</span></div>
          </div>
          <button onClick={startEdit} className="btn-primary px-4 py-2 text-xs shrink-0">
            {t('TimesCard.edit')}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {field(t('TimesCard.fieldStart'), start, setStart)}
          {field(t('TimesCard.fieldEnd'), end, setEnd)}
          {field(t('TimesCard.fieldQueue'), queue, setQueue)}
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="btn-primary flex-1 py-2 text-sm disabled:opacity-50">
              {saving ? t('TimesCard.saving') : t('TimesCard.save')}
            </button>
            <button onClick={() => setEditing(false)} className="btn-secondary px-4 py-2 text-sm">
              {t('TimesCard.cancel')}
            </button>
          </div>
          <p className="text-[11px] text-gray-400">{t('TimesCard.note')}</p>
        </div>
      )}
    </div>
  )
}
