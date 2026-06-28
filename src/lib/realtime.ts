// real-time: connect to a session's WebSocket room; the server nudges on any
// change so the leader's view updates instantly. Auto-reconnects.
export function connectSessionWS(sessionId: string, onChange: () => void): () => void {
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
    ws.onmessage = () => onChange()
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
