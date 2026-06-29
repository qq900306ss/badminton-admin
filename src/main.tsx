import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { CURRENT_BUILD } from './lib/appUpdate'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// register the service worker (PWA / installable). The ?v=<build> query makes the
// browser see a new SW each deploy → it reinstalls and re-caches a fresh app
// shell, so installed PWAs don't keep serving a stale index.html offline.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`/sw.js?v=${CURRENT_BUILD}`).catch(() => {})
  })
}
