import { useEffect, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SessionPlayer, PlayerSlot } from '../../api/client'
import { tierOf } from '../../lib/levels'
import { isPhotoUrl } from '../../lib/avatar'

// 手機底部抽屜:從下面滑上來,點背景或往下拖可關。團主單手操作,選項都放在拇指搆得到的地方。
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className="w-full sm:max-w-md bg-white rounded-t-[2rem] sm:rounded-[2rem] max-h-[85vh] flex flex-col shadow-2xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => info.offset.y > 120 && onClose()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pt-2.5 pb-1 flex justify-center shrink-0">
              <span className="w-10 h-1.5 rounded-full bg-gray-200" />
            </div>
            {title && <div className="px-5 pb-2 font-extrabold text-gray-800 shrink-0">{title}</div>}
            <div className="px-5 pb-5 overflow-y-auto overscroll-contain">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// 頭像:照片 / emoji / 名字首字,底色跟程度分級一致
export function Avatar({
  p,
  size = 'md',
}: {
  p: Pick<SessionPlayer | PlayerSlot, 'avatar_url' | 'display_name' | 'level'>
  size?: 'sm' | 'md' | 'lg'
}) {
  const cls = size === 'lg' ? 'w-11 h-11 text-lg' : size === 'sm' ? 'w-6 h-6 text-[11px]' : 'w-9 h-9 text-sm'
  const tier = tierOf(p.level)
  if (isPhotoUrl(p.avatar_url))
    return <img src={p.avatar_url} alt="" className={`${cls} rounded-full object-cover shrink-0 ring-2 ring-white`} />
  return (
    <span
      className={`${cls} rounded-full shrink-0 flex items-center justify-center font-bold text-white ring-2 ring-white ${
        tier ? tier.avatarBg : 'bg-gray-300'
      }`}
    >
      {p.avatar_url || [...(p.display_name ?? '')][0]?.toUpperCase()}
    </span>
  )
}

// 底部抽屜裡的一列選項
export function SheetAction({
  icon,
  label,
  hint,
  onClick,
  tone = 'default',
  disabled,
}: {
  icon: string
  label: string
  hint?: string
  onClick: () => void
  tone?: 'default' | 'danger'
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left active:bg-gray-100 disabled:opacity-40 ${
        tone === 'danger' ? 'text-red-500' : 'text-gray-700'
      }`}
    >
      <span className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-lg shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block font-bold text-[15px]">{label}</span>
        {hint && <span className="block text-xs text-gray-400">{hint}</span>}
      </span>
    </button>
  )
}
