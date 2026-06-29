import { InstallButton } from '../components/InstallButton'
import { isInAppBrowser } from '../lib/inAppBrowser'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const REDIRECT_URI = `${location.origin}/auth/callback`

export function LoginPage() {
  const inApp = isInAppBrowser()
  function loginWithGoogle() {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
    })
    location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  }

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-6">
      <div className="text-center mb-8">
        <div className="text-6xl mb-3">🏸</div>
        <h1 className="text-3xl font-extrabold text-gray-800">羽球場地管理</h1>
        <p className="text-gray-400 mt-2">團主後台</p>
      </div>
      {inApp && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-3 mb-5 max-w-xs text-left space-y-2">
          <p className="text-sm font-bold text-amber-700">⚠️ 請用瀏覽器開啟才能登入</p>
          <p className="text-xs text-amber-600">
            你現在是從 App 內建瀏覽器(Threads/IG/LINE…)開啟的,Google 登入會被擋。請點右上「⋯」或分享鍵 →
            選「在瀏覽器開啟 / 用 Safari 開啟」後再登入。
          </p>
          <button
            onClick={() => navigator.clipboard?.writeText(window.location.href)}
            className="text-xs font-bold text-amber-700 underline"
          >
            📋 複製網址(貼到瀏覽器開)
          </button>
        </div>
      )}
      <button
        onClick={loginWithGoogle}
        className="bg-white shadow-md rounded-2xl px-6 py-3 flex items-center gap-3
          font-bold text-gray-700 active:scale-95 transition-transform"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        使用 Google 登入
      </button>
      <p className="text-xs text-gray-300 mt-6 text-center max-w-xs">
        只有被授權的團主與管理員能登入
      </p>
      <div className="w-full max-w-xs mt-6">
        <InstallButton label="📲 安裝後台到桌面" />
      </div>
    </div>
  )
}
