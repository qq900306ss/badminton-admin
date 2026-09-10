import { useSyncExternalStore } from 'react'

// 與 booking 同一份設計:`beforeinstallprompt` 在頁面載入很早就發,常比元件 mount 早;
// 這個模組由 main.tsx 靜態匯入,app 一啟動就接住事件;元件用 useInstallPrompt() 訂閱。
export type BIPEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallState = {
  hasPrompt: boolean // 原生安裝框可用(只有真正的瀏覽器分頁會發;App 內視窗 / Custom Tab 不會)
  installed: boolean // standalone 或本分頁剛裝完
  installedHere: boolean // 本分頁剛裝完(appinstalled / accepted)— standalone 可能是別的 PWA 視窗繼承來的,這個才可信
}

let deferred: BIPEvent | null = null
let installedHere = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BIPEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installedHere = true
    notify()
  })
}

export function subscribeInstallPrompt(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

let snapshot: InstallState = { hasPrompt: false, installed: false, installedHere: false }
function getSnapshot(): InstallState {
  const next = { hasPrompt: deferred !== null, installed: installedHere || isStandalone(), installedHere }
  if (
    next.hasPrompt !== snapshot.hasPrompt ||
    next.installed !== snapshot.installed ||
    next.installedHere !== snapshot.installedHere
  )
    snapshot = next
  return snapshot
}

export function useInstallPrompt(): InstallState {
  return useSyncExternalStore(subscribeInstallPrompt, getSnapshot, getSnapshot)
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const e = deferred
  if (!e) return 'unavailable'
  deferred = null
  notify()
  await e.prompt()
  const { outcome } = await e.userChoice
  if (outcome === 'accepted') {
    installedHere = true
    notify()
  }
  return outcome
}
