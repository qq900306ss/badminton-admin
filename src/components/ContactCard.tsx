import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { sessionApi } from '../api/client'

// Leader sets the public-facing info shown to players on the lobby card /
// session page: 團簡介 (free text) + an external 聯繫團主 link (LINE group /
// 報名表 / 聯絡方式). Both optional — one card so the版面 stays tidy. The link
// is leader-supplied; the player UI warns before opening it.
export function ContactCard({
  sessionId,
  contactUrl,
  description,
}: {
  sessionId: string
  contactUrl?: string
  description?: string
}) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [url, setUrl] = useState('')
  const [desc, setDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function startEdit() {
    setUrl(contactUrl || '')
    setDesc(description || '')
    setErr('')
    setEditing(true)
  }

  async function save() {
    const v = url.trim()
    if (v && !/^https?:\/\//.test(v)) {
      setErr(t('ContactCard.errUrlScheme'))
      return
    }
    const d = desc.trim()
    if ([...d].length > 300) {
      setErr(t('ContactCard.errDescMax'))
      return
    }
    setSaving(true)
    setErr('')
    try {
      // 兩個各自的端點,哪個變了打哪個(都變就都打)
      if (d !== (description || '')) await sessionApi.setDescription(sessionId, d)
      if (v !== (contactUrl || '')) await sessionApi.setContact(sessionId, v)
      qc.invalidateQueries({ queryKey: ['session', sessionId] })
      setEditing(false)
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setErr(m ?? t('ContactCard.errUpdateFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card space-y-3">
      <div>
        <span className="font-bold text-gray-700">{t('ContactCard.heading')}</span>
        <p className="text-xs text-gray-400 mt-1">
          {t('ContactCard.hint')}
        </p>
      </div>
      {!editing ? (
        <div className="space-y-2">
          {description ? (
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{description}</p>
          ) : (
            <p className="text-sm text-gray-400">{t('ContactCard.noDesc')}</p>
          )}
          <div className="flex items-center gap-2">
            <span className="flex-1 text-sm text-gray-600 break-all">
              {contactUrl || <span className="text-gray-400">{t('ContactCard.noLink')}</span>}
            </span>
            <button onClick={startEdit} className="btn-primary px-4 py-2 text-xs shrink-0">
              {description || contactUrl ? t('ContactCard.edit') : t('ContactCard.add')}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder={t('ContactCard.descPlaceholder')}
            rows={4}
            maxLength={300}
            className="w-full border-2 border-gray-200 rounded-2xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-brand-pink"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t('ContactCard.urlPlaceholder')}
            inputMode="url"
            className="w-full border-2 border-gray-200 rounded-2xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
          />
          {err && <p className="text-red-400 text-xs">{err}</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="btn-primary flex-1 py-2 text-sm disabled:opacity-40">
              {saving ? t('ContactCard.saving') : t('ContactCard.save')}
            </button>
            <button onClick={() => setEditing(false)} className="btn-secondary px-4 text-sm">{t('ContactCard.cancel')}</button>
          </div>
          <p className="text-[11px] text-gray-400">{t('ContactCard.removeHint')}</p>
        </div>
      )}
    </div>
  )
}
