import { useState } from 'react'
import { sessionApi, type Org } from '../api/client'

function readOrg(): Org | null {
  try {
    return JSON.parse(localStorage.getItem('org') || 'null')
  } catch {
    return null
  }
}

// Leader edits their own team name. Lives inside the ⚙️ settings modal. Keeps the
// cached `org` in localStorage in sync and notifies the parent so the header
// updates live.
export function OrgNameCard({ onRenamed }: { onRenamed?: (name: string) => void }) {
  const [name, setName] = useState(readOrg()?.org_name ?? '')
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    const n = input.trim()
    if (!n) return
    setSaving(true)
    setErr('')
    try {
      const r = await sessionApi.renameMyOrg(n)
      const updated = r.data.data
      localStorage.setItem('org', JSON.stringify(updated))
      setName(updated.org_name)
      onRenamed?.(updated.org_name)
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
      <span className="font-bold text-gray-700">👥 團名</span>
      {!editing ? (
        <div className="flex items-center gap-2">
          <span className="flex-1 font-bold text-gray-700 truncate">{name || '(未命名)'}</span>
          <button
            onClick={() => {
              setInput(name)
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
            placeholder="輸入新團名"
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
