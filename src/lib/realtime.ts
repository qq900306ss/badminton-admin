// real-time: connect to a session's WebSocket room. The server now pushes the
// CHANGED DATA in the message (view / players) so clients apply it directly
// instead of re-calling the API; a bare nudge (no payload) still means
// "refetch yourself" as fallback. Auto-reconnects; onStatus reports socket
// health so pollers can slow down while live.
import type { SessionView, SessionPlayer } from '../api/client'

export type RTMessage =
  | {
      t: 'changed'
      scope?: 'court' | 'player' | 'game' | 'session' | 'all'
      at?: number // server ms timestamp — clients drop out-of-order payloads
      view?: SessionView
      players?: SessionPlayer[]
    }
  | { t: 'removed'; player: string; msg: string }
  | { t: 'renamed'; player: string; msg: string }

export function connectSessionWS(
  sessionId: string,
  onMessage: (m: RTMessage) => void,
  onStatus?: (up: boolean) => void
): () => void {
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
    ws.onopen = () => onStatus?.(true)
    ws.onmessage = (e) => {
      try {
        onMessage(JSON.parse(e.data))
      } catch {
        /* ignore malformed */
      }
    }
    ws.onclose = () => {
      onStatus?.(false)
      schedule()
    }
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
