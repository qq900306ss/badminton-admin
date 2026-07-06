import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { sessionApi } from '../api/client'
import type { SessionView } from '../api/client'

// 前台報名設定(⚙️ 這場設定內):開關 + 收人名額。名額是軟上限——滿了照樣
// 可以報名,只影響顯示與核准時的提醒,團主從報名池挑人。
export function SignupSettingsCard({ sessionId, view }: { sessionId: string; view?: SessionView }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [quotaInput, setQuotaInput] = useState<string | null>(null) // null = 未在編輯
  const [err, setErr] = useState('')

  const open = view?.signup_open ?? false
  const quota = view?.signup_quota ?? 0

  async function update(s: { signup_open?: boolean; signup_quota?: number }) {
    setSaving(true)
    setErr('')
    try {
      await sessionApi.setSignupSettings(sessionId, s)
      qc.invalidateQueries({ queryKey: ['session', sessionId] })
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setErr(m ?? t('SignupSettingsCard.errUpdateFailed'))
    } finally {
      setSaving(false)
    }
  }

  function saveQuota() {
    const raw = (quotaInput ?? '').trim()
    const q = raw === '' ? 0 : Number(raw)
    if (!Number.isInteger(q) || q < 0 || q > 200) {
      setErr(t('SignupSettingsCard.errQuota'))
      return
    }
    setQuotaInput(null)
    void update({ signup_quota: q })
  }

  return (
    <div className="card space-y-3">
      <label className="flex items-center justify-between">
        <div>
          <span className="font-bold text-gray-700">{t('SignupSettingsCard.heading')}</span>
          <p className="text-xs text-gray-400 mt-1">
            {t('SignupSettingsCard.hint')}
          </p>
        </div>
        <input
          type="checkbox"
          checked={open}
          disabled={saving}
          onChange={(e) => void update({ signup_open: e.target.checked })}
          className="w-5 h-5 accent-pink-400 shrink-0 ml-3"
        />
      </label>
      {open && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 shrink-0">{t('SignupSettingsCard.quotaLabel')}</span>
          {quotaInput === null ? (
            <>
              <span className="text-sm font-bold text-gray-700">{quota > 0 ? t('SignupSettingsCard.quotaPeople', { n: quota }) : t('SignupSettingsCard.unlimited')}</span>
              <button
                onClick={() => setQuotaInput(quota > 0 ? String(quota) : '')}
                className="text-xs font-bold text-brand-pink"
              >
                {t('SignupSettingsCard.edit')}
              </button>
            </>
          ) : (
            <>
              <input
                value={quotaInput}
                onChange={(e) => setQuotaInput(e.target.value)}
                placeholder={t('SignupSettingsCard.unlimited')}
                inputMode="numeric"
                autoFocus
                className="w-20 border-2 border-gray-200 rounded-2xl px-3 py-1.5 text-sm text-center
                  focus:outline-none focus:border-brand-pink"
              />
              <button onClick={saveQuota} disabled={saving} className="text-xs font-bold text-brand-pink">{t('SignupSettingsCard.save')}</button>
              <button onClick={() => setQuotaInput(null)} className="text-xs text-gray-400">{t('SignupSettingsCard.cancel')}</button>
            </>
          )}
          <span className="text-[11px] text-gray-400">{t('SignupSettingsCard.quotaNote')}</span>
        </div>
      )}
      {err && <p className="text-red-400 text-xs">{err}</p>}
    </div>
  )
}
