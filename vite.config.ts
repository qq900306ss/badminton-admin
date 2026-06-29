import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// one id per build: baked into the bundle AND emitted as /version.json, so the
// running app can poll version.json and notice when a newer build is deployed.
const BUILD_ID = `${Date.now()}`

// https://vite.dev/config/
export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [
    react(),
    {
      name: 'emit-version-json',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ build: BUILD_ID }),
        })
      },
    },
  ],
  // Must be 5173 — matches the Google OAuth redirect URI we registered.
  server: { port: 5173, strictPort: true },
})
