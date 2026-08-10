import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { sessionApi } from '../api/client'

// 場內公告:團主寫給場內所有人看的即時訊息(例如「10 點後小聲點」「打完聚餐」)。
// 玩家端顯示成可收合的 📢 卡片,內容一改所有人即時看到(WS)。空白=不顯示。
export function AnnouncementCard({
  sessionId,
  announcement,
}: {
  sessionId: string
  announcement?: string
}) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function startEdit() {
    setText(announcement || '')
    setErr('')
    setEditing(true)
  }

  async function save() {
    const v = text.trim()
    if ([...v].length > 500) {
      setErr(t('AnnouncementCard.errMax'))
      return
    }
    setSaving(true)
    setErr('')
    try {
      await sessionApi.setAnnouncement(sessionId, v)
      qc.invalidateQueries({ queryKey: ['session', sessionId] })
      setEditing(false)
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setErr(m ?? t('AnnouncementCard.errFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-bold text-gray-700">📢 {t('AnnouncementCard.heading')}</span>
        {!editing && (
          <button onClick={startEdit} className="btn-secondary px-3 py-1.5 text-xs shrink-0">
            {announcement ? t('AnnouncementCard.edit') : t('AnnouncementCard.add')}
          </button>
        )}
      </div>
      {!editing ? (
        announcement ? (
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{announcement}</p>
        ) : (
          <p className="text-xs text-gray-400">{t('AnnouncementCard.hint')}</p>
        )
      ) : (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('AnnouncementCard.placeholder')}
            rows={4}
            maxLength={500}
            autoFocus
            className="w-full border-2 border-gray-200 rounded-2xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-brand-pink"
          />
          {err && <p className="text-red-400 text-xs">{err}</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="btn-primary flex-1 py-2 text-sm disabled:opacity-40">
              {saving ? t('AnnouncementCard.saving') : t('AnnouncementCard.publish')}
            </button>
            <button onClick={() => setEditing(false)} className="btn-secondary px-4 text-sm">{t('AnnouncementCard.cancel')}</button>
          </div>
          <p className="text-[11px] text-gray-400">{t('AnnouncementCard.removeHint')}</p>
        </div>
      )}
    </div>
  )
}
