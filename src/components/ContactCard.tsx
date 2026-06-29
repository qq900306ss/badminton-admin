import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { sessionApi } from '../api/client'

// Leader sets an external 聯繫團主 link (LINE group / 報名表 / 聯絡方式) shown to
// players on the lobby card. Optional — leave blank to hide it. The link is
// leader-supplied; the player UI warns before opening it.
export function ContactCard({
  sessionId,
  contactUrl,
}: {
  sessionId: string
  contactUrl?: string
}) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function startEdit() {
    setUrl(contactUrl || '')
    setErr('')
    setEditing(true)
  }

  async function save() {
    const v = url.trim()
    if (v && !/^https?:\/\//.test(v)) {
      setErr('連結需以 http:// 或 https:// 開頭')
      return
    }
    setSaving(true)
    setErr('')
    try {
      await sessionApi.setContact(sessionId, v)
      qc.invalidateQueries({ queryKey: ['session', sessionId] })
      setEditing(false)
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setErr(m ?? '更新失敗,請稍後再試')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card space-y-3">
      <div>
        <span className="font-bold text-gray-700">🔗 聯繫團主連結</span>
        <p className="text-xs text-gray-400 mt-1">
          選填。臨打人首頁會出現一顆「聯繫團主」按鈕(可放 LINE 群、報名表等)。
        </p>
      </div>
      {!editing ? (
        <div className="flex items-center gap-2">
          <span className="flex-1 text-sm text-gray-600 break-all">
            {contactUrl || <span className="text-gray-400">未設定</span>}
          </span>
          <button onClick={startEdit} className="btn-primary px-4 py-2 text-xs shrink-0">
            {contactUrl ? '修改' : '新增'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://line.me/..."
            inputMode="url"
            className="w-full border-2 border-gray-200 rounded-2xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
          />
          {err && <p className="text-red-400 text-xs">{err}</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="btn-primary flex-1 py-2 text-sm disabled:opacity-40">
              {saving ? '儲存中…' : '儲存'}
            </button>
            <button onClick={() => setEditing(false)} className="btn-secondary px-4 text-sm">取消</button>
          </div>
          <p className="text-[11px] text-gray-400">留空白並儲存即可移除連結。</p>
        </div>
      )}
    </div>
  )
}
