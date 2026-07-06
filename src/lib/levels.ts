// 台灣羽球推廣協會 羽球程度分級制度 (1-18)
import i18n from '../i18n'

export interface LevelTier {
  name: string
  min: number
  max: number
  note: string // 球齡 / 對應零打團程度
  avatarBg: string // full Tailwind classes (literal, so JIT keeps them)
  chip: string
}

// Structural, language-independent tier data. `key` indexes into the
// `levels.tiers.<key>` translations for name/note (read at call time so they
// follow the current language).
const TIER_DATA: { key: string; min: number; max: number; avatarBg: string; chip: string }[] = [
  { key: 'novice', min: 1, max: 3, avatarBg: 'bg-rose-300', chip: 'bg-rose-100 text-rose-600' },
  { key: 'beginner', min: 4, max: 5, avatarBg: 'bg-emerald-300', chip: 'bg-emerald-100 text-emerald-700' },
  { key: 'lowerIntermediate', min: 6, max: 7, avatarBg: 'bg-teal-300', chip: 'bg-teal-100 text-teal-700' },
  { key: 'intermediate', min: 8, max: 9, avatarBg: 'bg-amber-300', chip: 'bg-amber-100 text-amber-700' },
  { key: 'upperIntermediate', min: 10, max: 12, avatarBg: 'bg-sky-300', chip: 'bg-sky-100 text-sky-700' },
  { key: 'advanced', min: 13, max: 15, avatarBg: 'bg-slate-400', chip: 'bg-slate-100 text-slate-700' },
  { key: 'professional', min: 16, max: 18, avatarBg: 'bg-violet-400', chip: 'bg-violet-100 text-violet-700' },
]

function toTier(d: (typeof TIER_DATA)[number]): LevelTier {
  return {
    name: i18n.t(`levels.tiers.${d.key}.name`),
    note: i18n.t(`levels.tiers.${d.key}.note`),
    min: d.min,
    max: d.max,
    avatarBg: d.avatarBg,
    chip: d.chip,
  }
}

// Localized tier list (name/note reflect the current language). Call inside a
// render/handler so it re-reads on language change.
export function getTiers(): LevelTier[] {
  return TIER_DATA.map(toTier)
}

export function tierOf(level: number): LevelTier | null {
  if (!level) return null
  const d = TIER_DATA.find((t) => level >= t.min && level <= t.max)
  return d ? toTier(d) : null
}

// per-level skill description (從分級表轉錄) — localized lookup for levels 1-18.
export function levelDesc(level: number): string {
  return i18n.t(`levels.desc.${level}`)
}
