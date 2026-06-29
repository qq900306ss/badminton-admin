import { useState } from 'react'
import { sessionApi } from '../api/client'

// Leader feedback: a small button that opens a textarea modal and posts to
// /my/feedback (super admin reads it). Self-contained.
export function FeedbackButton({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function send() {
    const m = msg.trim()
    if (!m) return
    setSending(true)
    setError('')
    try {
      await sessionApi.sendFeedback(m)
      setDone(true)
      setMsg('')
      setTimeout(() => {
        setDone(false)
        setOpen(false)
      }, 1500)
    } catch (e: unknown) {
      const em = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(em ?? '送出失敗,請稍後再試')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={className || 'text-xs font-bold text-gray-400 hover:text-brand-pink'}
      >
        💬 意見回饋
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-50"
          onClick={() => setOpen(false)}
        >
          <div className="card w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-gray-700">💬 意見回饋</span>
              <button onClick={() => setOpen(false)} className="text-gray-400 font-bold">
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-400">有任何問題或建議都可以告訴我們 🙏</p>
            <textarea
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="想說什麼…"
              rows={4}
              maxLength={1000}
              className="w-full border-2 border-gray-200 rounded-2xl px-3 py-2 text-sm
                focus:outline-none focus:border-brand-pink resize-none"
            />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button
              onClick={send}
              disabled={!msg.trim() || sending}
              className="btn-primary w-full text-sm disabled:opacity-40"
            >
              {done ? '✓ 已送出,謝謝!' : sending ? '送出中…' : '送出'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
