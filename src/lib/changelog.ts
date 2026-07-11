// User-facing changelog shown in the「更新資訊」modal. Newest first. Keep entries
// short and in plain language (團主 audience).
import i18n from '../i18n'

export interface ChangelogEntry {
  date: string
  items: string[]
}

// Release dates + how many bullet items each release has. The item text lives
// in the changelog locale fragments (keys `changelog.r<release>.i<item>`) and is
// read at call time so it follows the current language.
const RELEASES: { date: string; count: number }[] = [
  { date: '2026/07/11', count: 3 },
  { date: '2026/07/06', count: 1 },
  { date: '2026/07/05', count: 2 },
  { date: '2026/07/03', count: 5 },
  { date: '2026/06/30', count: 2 },
  { date: '2026/06/29', count: 11 },
]

// Localized changelog. Call inside a render so it re-reads on language change.
export function getChangelog(): ChangelogEntry[] {
  return RELEASES.map((r, ri) => ({
    date: r.date,
    items: Array.from({ length: r.count }, (_, ii) => i18n.t(`changelog.r${ri}.i${ii}`)),
  }))
}
