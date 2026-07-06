import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'

interface ConfirmOptions {
  message: string
  confirmText?: string
  danger?: boolean
}

const ConfirmCtx = createContext<(o: ConfirmOptions | string) => Promise<boolean>>(
  async () => false
)
export const useConfirm = () => useContext(ConfirmCtx)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<(v: boolean) => void>(() => {})

  // 防呆: a destructive confirm button stays disabled briefly after opening, so a
  // reflexive double-tap (e.g. bleeding through from another button) can't instantly
  // confirm something irreversible like 結束開團.
  const [armed, setArmed] = useState(true)
  useEffect(() => {
    if (!opts?.danger) {
      setArmed(true)
      return
    }
    setArmed(false)
    const t = setTimeout(() => setArmed(true), 600)
    return () => clearTimeout(t)
  }, [opts])

  const confirm = useCallback((o: ConfirmOptions | string) => {
    setOpts(typeof o === 'string' ? { message: o } : o)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  function done(v: boolean) {
    resolver.current(v)
    setOpts(null)
  }

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {opts && (
          <motion.div
            className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => done(false)}
          >
            <motion.div
              className="bg-white rounded-3xl p-6 w-full max-w-xs space-y-4 text-center"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-4xl">{opts.danger ? '⚠️' : '🏸'}</p>
              <p className="font-bold text-gray-700">{opts.message}</p>
              <div className="flex gap-2">
                <button onClick={() => done(false)} className="btn-secondary flex-1">{t('Confirm.cancel')}</button>
                <button
                  onClick={() => armed && done(true)}
                  disabled={opts.danger && !armed}
                  className={`flex-1 font-bold py-3 px-6 rounded-2xl text-white active:scale-95 transition-transform ${
                    opts.danger ? 'bg-red-400' : 'bg-brand-pink'
                  } ${opts.danger && !armed ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {opts.danger && !armed ? t('Confirm.pleaseWait') : opts.confirmText || t('Confirm.confirm')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmCtx.Provider>
  )
}
