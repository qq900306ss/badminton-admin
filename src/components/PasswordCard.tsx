import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSessionPassword, useSetPassword } from '../hooks/useApi'

// Leader-only: view the current gate code and change it. Sessions created before
// plaintext storage return "" — we can't show the old code, only set a new one.
export function PasswordCard({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation()
  const { data: password, isLoading } = useSessionPassword(sessionId)
  const setPassword = useSetPassword(sessionId)

  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [reveal, setReveal] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const legacy = !isLoading && !password // empty → old session, code unknown

  function startEdit() {
    setValue(password ?? '')
    setError('')
    setSaved(false)
    setEditing(true)
  }

  async function save() {
    const pw = value.trim()
    if (!pw) {
      setError(t('PasswordCard.errBlank'))
      return
    }
    try {
      await setPassword.mutateAsync(pw)
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? t('PasswordCard.errUpdate'))
    }
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-bold text-gray-700">{t('PasswordCard.title')}</span>
        {saved && <span className="text-xs font-bold text-emerald-600">{t('PasswordCard.updated')}</span>}
      </div>

      {!editing ? (
        <div className="flex items-center gap-2">
          {isLoading ? (
            <span className="text-sm text-gray-300">{t('PasswordCard.loading')}</span>
          ) : legacy ? (
            <span className="text-sm text-gray-400 flex-1">
              {t('PasswordCard.legacyHint')}
            </span>
          ) : (
            <>
              <code className="flex-1 bg-gray-50 rounded-xl px-3 py-2 text-lg font-bold tracking-wider text-gray-700">
                {reveal ? password : '•'.repeat(Math.min((password ?? '').length, 12))}
              </code>
              <button
                onClick={() => setReveal((r) => !r)}
                className="btn-secondary px-3 py-2 text-xs shrink-0"
              >
                {reveal ? t('PasswordCard.hide') : t('PasswordCard.show')}
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(password ?? '')}
                className="btn-secondary px-3 py-2 text-xs shrink-0"
              >
                {t('PasswordCard.copy')}
              </button>
            </>
          )}
          <button onClick={startEdit} className="btn-primary px-4 py-2 text-xs shrink-0">
            {t('PasswordCard.edit')}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
            }}
            placeholder={t('PasswordCard.newPwPlaceholder')}
            autoFocus
            className="w-full border-2 border-gray-200 rounded-2xl px-4 py-2.5 text-lg font-bold
              focus:outline-none focus:border-brand-pink"
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={setPassword.isPending}
              className="btn-primary flex-1 py-2 text-sm disabled:opacity-50"
            >
              {setPassword.isPending ? t('PasswordCard.saving') : t('PasswordCard.saveNew')}
            </button>
            <button
              onClick={() => {
                setEditing(false)
                setError('')
              }}
              className="btn-secondary px-4 py-2 text-sm"
            >
              {t('PasswordCard.cancel')}
            </button>
          </div>
          <p className="text-[11px] text-gray-400">
            {t('PasswordCard.note')}
          </p>
        </div>
      )}
    </div>
  )
}
