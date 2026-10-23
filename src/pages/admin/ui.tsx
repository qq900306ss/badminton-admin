import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { isPhotoUrl } from '../../lib/avatar'

// 超級後台各分頁共用的小元件

// 頭像:照片網址 → <img>,emoji → 字,其他 → 第一個字
export function Swatch({ url, fallback, size = 'md' }: { url?: string; fallback: string; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'w-14 h-14 text-2xl' : size === 'sm' ? 'w-7 h-7 text-sm' : 'w-10 h-10 text-lg'
  if (isPhotoUrl(url)) return <img src={url} alt="" className={`${cls} rounded-full object-cover shrink-0`} />
  return (
    <span className={`${cls} rounded-full bg-gray-100 flex items-center justify-center shrink-0`}>{url || fallback}</span>
  )
}

// 停權 / 解除停權(成員列表、詳情與檢舉共用);停權由呼叫端先確認
export function BanToggle({
  banned,
  pending,
  boxed,
  onBan,
  onUnban,
}: {
  banned: boolean
  pending: boolean
  boxed?: boolean
  onBan: () => void
  onUnban: () => void
}) {
  const { t } = useTranslation()
  return (
    <button
      onClick={banned ? onUnban : onBan}
      disabled={pending}
      className={`text-xs font-bold shrink-0 disabled:opacity-50 ${boxed ? 'px-3 py-1.5 rounded-2xl border-2' : ''} ${
        banned ? 'text-emerald-600 border-emerald-200' : 'text-red-500 border-red-200'
      }`}
    >
      {banned ? t('AdminPage.unban') : t('AdminPage.ban')}
    </button>
  )
}

// 篩選小膠囊:active 時填色;count 有給就顯示在後面
export function Pill({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  count?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap transition-colors ${
        active ? 'bg-brand-pink text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
      }`}
    >
      {children}
      {count !== undefined && <span className={active ? 'opacity-90' : 'text-gray-400'}> {count}</span>}
    </button>
  )
}

// 一列篩選:左邊小標題,右邊可橫向捲動的膠囊
export function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[11px] font-bold text-gray-400 w-14 shrink-0 pt-1">{label}</span>
      <div className="flex flex-wrap gap-1.5 min-w-0">{children}</div>
    </div>
  )
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  disabled,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  disabled?: boolean
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      disabled={disabled}
      className="border-2 border-gray-200 rounded-2xl px-3 py-1.5 text-sm bg-white disabled:opacity-40 focus:outline-none focus:border-brand-pink"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative flex-1 min-w-[10rem]">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border-2 border-gray-200 rounded-2xl pl-3 pr-8 py-1.5 text-sm focus:outline-none focus:border-brand-pink"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-sm"
          aria-label="clear"
        >
          ✕
        </button>
      )}
    </div>
  )
}

// 小數字格:標題 + 大數字
export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="bg-gray-50 rounded-2xl px-3 py-2 min-w-0">
      <div className="text-[11px] text-gray-400 truncate">{label}</div>
      <div className="text-lg font-extrabold text-gray-800 leading-tight">{value}</div>
      {hint && <div className="text-[10px] text-gray-400 truncate">{hint}</div>}
    </div>
  )
}

// 長列表的「顯示更多」
export function MoreButton({ shown, total, onMore }: { shown: number; total: number; onMore: () => void }) {
  const { t } = useTranslation()
  if (shown >= total) return null
  return (
    <button onClick={onMore} className="w-full py-2 text-sm font-bold text-brand-pink">
      {t('AdminConsole.showMore', { shown, total })}
    </button>
  )
}

const TONE = {
  gray: 'border-gray-200 text-gray-600',
  pink: 'border-brand-pink text-brand-pink',
  green: 'border-emerald-200 text-emerald-600',
  amber: 'border-amber-200 text-amber-600',
  red: 'border-red-200 text-red-500',
}

export function ActionBtn({
  children,
  onClick,
  tone = 'gray',
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  tone?: keyof typeof TONE
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-xs font-bold px-3 py-1.5 rounded-2xl border-2 bg-white disabled:opacity-50 ${TONE[tone]}`}
    >
      {children}
    </button>
  )
}
