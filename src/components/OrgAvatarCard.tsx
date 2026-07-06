import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { sessionApi, type Org } from '../api/client'
import { AVATAR_EMOJIS, isPhotoUrl } from '../lib/avatar'

export const DEFAULT_ORG_AVATAR = '🐰' // 團主沒設定頭像時的預設

// One avatar per leader, shared across every team they open. Stored on the org;
// players see it on the lobby card + session header. Emoji or uploaded photo.
export function OrgAvatarCard({ org }: { org: Org | null }) {
  const { t } = useTranslation()
  const [avatar, setAvatar] = useState(org?.avatar_url || '')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function startEdit() {
    setDraft(avatar)
    setErr('')
    setEditing(true)
  }

  async function uploadPhoto(file: File) {
    if (file.size > 3 * 1024 * 1024) {
      setErr(t('OrgAvatarCard.errPhotoSize'))
      return
    }
    setUploading(true)
    setErr('')
    try {
      const ct = file.type || 'image/jpeg'
      const r = await sessionApi.orgAvatarUploadUrl(ct)
      const { upload_url, public_url } = r.data.data
      const put = await fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': ct } })
      if (!put.ok) throw new Error('upload failed')
      setDraft(public_url)
    } catch {
      setErr(t('OrgAvatarCard.errUpload'))
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    setSaving(true)
    setErr('')
    try {
      const r = await sessionApi.setMyOrgAvatar(draft.trim())
      // persist the refreshed org so it survives reload + other reads of localStorage
      localStorage.setItem('org', JSON.stringify(r.data.data))
      setAvatar(r.data.data.avatar_url || '')
      setEditing(false)
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setErr(m ?? t('OrgAvatarCard.errUpdate'))
    } finally {
      setSaving(false)
    }
  }

  // what to render in the preview bubble (falls back to 🐰)
  const shown = (editing ? draft : avatar) || DEFAULT_ORG_AVATAR

  return (
    <div className="card space-y-3">
      <div>
        <span className="font-bold text-gray-700">{t('OrgAvatarCard.title')}</span>
        <p className="text-xs text-gray-400 mt-1">
          {t('OrgAvatarCard.desc')}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-brand-pink/15 flex items-center justify-center shrink-0 overflow-hidden">
          {isPhotoUrl(shown) ? (
            <img src={shown} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl">{shown}</span>
          )}
        </div>
        {!editing && (
          <button onClick={startEdit} className="btn-primary px-4 py-2 text-sm">
            {t('OrgAvatarCard.editAvatar')}
          </button>
        )}
      </div>

      {editing && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <label className="text-xs font-bold text-brand-pink border-2 border-brand-pink/40 rounded-full px-3 py-1.5 cursor-pointer">
              {uploading ? t('OrgAvatarCard.uploading') : t('OrgAvatarCard.uploadPhoto')}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) uploadPhoto(f)
                }}
              />
            </label>
            <button
              onClick={() => setDraft('')}
              className="text-xs font-bold text-gray-500 border-2 border-gray-200 rounded-full px-3 py-1.5"
            >
              {t('OrgAvatarCard.resetDefault')}
            </button>
          </div>
          <div className="grid grid-cols-8 gap-1.5">
            {AVATAR_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setDraft(e)}
                className={`text-xl rounded-lg py-1 ${draft === e ? 'bg-brand-pink/20 ring-2 ring-brand-pink' : 'hover:bg-gray-100'}`}
              >
                {e}
              </button>
            ))}
          </div>
          {err && <p className="text-red-400 text-xs">{err}</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="btn-primary flex-1 py-2 text-sm disabled:opacity-40">
              {saving ? t('OrgAvatarCard.saving') : t('OrgAvatarCard.save')}
            </button>
            <button onClick={() => setEditing(false)} className="btn-secondary px-4 text-sm">{t('OrgAvatarCard.cancel')}</button>
          </div>
        </div>
      )}
      {!editing && err && <p className="text-red-400 text-xs">{err}</p>}
    </div>
  )
}
