import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/client'

export function AuthCallback() {
  const nav = useNavigate()
  const [error, setError] = useState('')
  const ran = useRef(false)

  useEffect(() => {
    // guard against React StrictMode double-invoke (codes are single-use)
    if (ran.current) return
    ran.current = true

    const code = new URLSearchParams(location.search).get('code')
    if (!code) {
      setError('沒有收到 Google 授權碼')
      return
    }
    authApi
      .google(code)
      .then((res) => {
        localStorage.setItem('token', res.data.data.token)
        localStorage.setItem('org', JSON.stringify(res.data.data.org))
        nav('/', { replace: true })
      })
      .catch((err) => {
        const msg = err?.response?.data?.error ?? '登入失敗'
        setError(msg)
      })
  }, [nav])

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6">
      {error ? (
        <div className="card text-center space-y-3 max-w-sm">
          <div className="text-4xl">😕</div>
          <p className="font-bold text-gray-700">{error}</p>
          <button onClick={() => nav('/login', { replace: true })} className="btn-primary">
            回登入頁
          </button>
        </div>
      ) : (
        <div className="text-center">
          <div className="text-4xl animate-bounce mb-2">🏸</div>
          <p className="text-gray-400">登入中...</p>
        </div>
      )}
    </div>
  )
}
