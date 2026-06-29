declare const __BUILD_ID__: string

// the build this running app was compiled from
export const CURRENT_BUILD = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'

// Ask the server which build is currently deployed. Returns true when a NEWER
// build is live than the one we're running. Best-effort (network/parse errors →
// false, never nags spuriously).
export async function isUpdateAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return false
    const { build } = (await res.json()) as { build?: string }
    return !!build && build !== CURRENT_BUILD && CURRENT_BUILD !== 'dev'
  } catch {
    return false
  }
}

// Force the PWA to pick up the latest deploy: refresh the service worker, drop
// all caches, then hard-reload. Installed PWAs otherwise keep serving the cached
// build until the OS decides to update them — this is the manual "清除快取 + F5".
export async function forceUpdate() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.update().catch(() => {})))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch {
    /* best-effort — reload anyway */
  }
  // cache-busting query so even an HTTP-cached index.html is bypassed once
  const url = new URL(window.location.href)
  url.searchParams.set('_v', Date.now().toString())
  window.location.replace(url.toString())
}
