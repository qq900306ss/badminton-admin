import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { sessionApi } from '../api/client'
import { TW_CITIES } from '../lib/twCities'
import { TW_DISTRICTS } from '../lib/twDistricts'

// Leader edits the session's 縣市 / 區 after it's been opened (settings modal).
export function LocationCard({
  sessionId,
  city,
  district,
}: {
  sessionId: string
  city?: string
  district?: string
}) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [c, setC] = useState('台中市')
  const [d, setD] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function startEdit() {
    setC(city || '台中市')
    setD(district || '')
    setErr('')
    setEditing(true)
  }

  async function save() {
    if (!d.trim()) {
      setErr(t('LocationCard.errSelectDistrict'))
      return
    }
    setSaving(true)
    setErr('')
    try {
      await sessionApi.setLocation(sessionId, c, d.trim())
      qc.invalidateQueries({ queryKey: ['session', sessionId] })
      setEditing(false)
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setErr(m ?? t('LocationCard.errUpdate'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card space-y-3">
      <span className="font-bold text-gray-700">{t('LocationCard.title')}</span>
      {!editing ? (
        <div className="flex items-center gap-2">
          <span className="flex-1 font-bold text-gray-700">
            {city || t('LocationCard.notSet')} {district || ''}
          </span>
          <button onClick={startEdit} className="btn-primary px-4 py-2 text-xs shrink-0">
            {t('LocationCard.edit')}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <select
              value={c}
              onChange={(e) => {
                setC(e.target.value)
                setD('') // 換縣市清空區
              }}
              className="flex-1 border-2 border-gray-200 rounded-2xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-brand-pink"
            >
              {TW_CITIES.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
            {TW_DISTRICTS[c] ? (
              <select
                value={d}
                onChange={(e) => setD(e.target.value)}
                className="flex-1 border-2 border-gray-200 rounded-2xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-brand-pink"
              >
                <option value="">{t('LocationCard.selectDistrict')}</option>
                {TW_DISTRICTS[c].map((dist) => (
                  <option key={dist} value={dist}>{dist}</option>
                ))}
              </select>
            ) : (
              <input
                value={d}
                onChange={(e) => setD(e.target.value)}
                placeholder={t('LocationCard.districtPlaceholder')}
                className="flex-1 border-2 border-gray-200 rounded-2xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
              />
            )}
          </div>
          {err && <p className="text-red-400 text-xs">{err}</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="btn-primary flex-1 py-2 text-sm disabled:opacity-40">
              {saving ? t('LocationCard.saving') : t('LocationCard.save')}
            </button>
            <button onClick={() => setEditing(false)} className="btn-secondary px-4 text-sm">{t('LocationCard.cancel')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
