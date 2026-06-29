import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { sessionApi } from '../api/client'

// Rename the 開團 — this is the title 臨打人 see (lobby / 進場 / 球場頁). Lives in
// the session's ⚙️ settings modal. Invalidates the session query so the new name
// shows everywhere immediately.
export function SessionTitleCard({ sessionId, title }: { sessionId: string; title?: string }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    const t = input.trim()
    if (!t) return
    setSaving(true)
    setErr('')
    try {
      await sessionApi.setTitle(sessionId, t)
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
      <span className="font-bold text-gray-700">🏷️ 開團名稱(臨打人看到的)</span>
      {!editing ? (
        <div className="flex items-center gap-2">
          <span className="flex-1 font-bold text-gray-700 truncate">{title || '(未命名)'}</span>
          <button
            onClick={() => {
              setInput(title ?? '')
              setErr('')
              setEditing(true)
            }}
            className="btn-primary px-4 py-2 text-xs shrink-0"
          >
            改名
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
            }}
            maxLength={40}
            autoFocus
            placeholder="例如 週六晚雙打團"
            className="w-full border-2 border-gray-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-pink"
          />
          {err && <p className="text-red-400 text-xs">{err}</p>}
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={!input.trim() || saving}
              className="btn-primary flex-1 py-2 text-sm disabled:opacity-40"
            >
              {saving ? '儲存中…' : '儲存'}
            </button>
            <button onClick={() => setEditing(false)} className="btn-secondary px-4 text-sm">
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
