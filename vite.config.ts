import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Must be 5173 — matches the Google OAuth redirect URI we registered.
  server: { port: 5173, strictPort: true },
})
