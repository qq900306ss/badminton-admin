// real-time: connect to a session's WebSocket room; the server nudges on any
// change (with a `scope` saying WHAT changed) so the leader's view updates
// instantly + surgically. Auto-reconnects.
export type RTNudge = { t?: string; scope?: 'court' | 'player' | 'game' | 'all' }
export function connectSessionWS(sessionId: string, onChange: (m: RTNudge) => void): () => void {
  const base = (import.meta.env.VITE_API_URL || '').replace(/^http/, 'ws')
  if (!base || !sessionId) return () => {}
  let ws: WebSocket | null = null
  let closed = false
  let retry: ReturnType<typeof setTimeout> | undefined

  function open() {
    if (closed) return
    try {
      ws = new WebSocket(`${base}/api/sessions/${sessionId}/ws`)
    } catch {
      schedule()
      return
    }
    ws.onmessage = (ev) => {
      let m: RTNudge = {}
      try {
        m = JSON.parse(ev.data)
      } catch {
        /* ignore malformed */
      }
      onChange(m)
    }
    ws.onclose = () => schedule()
    ws.onerror = () => {
      try {
        ws?.close()
      } catch {
        /* ignore */
      }
    }
  }
  function schedule() {
    if (closed) return
    clearTimeout(retry)
    retry = setTimeout(open, 2500)
  }

  open()
  return () => {
    closed = true
    clearTimeout(retry)
    try {
      ws?.close()
    } catch {
      /* ignore */
    }
  }
}
