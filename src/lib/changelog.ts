// User-facing changelog shown in the「更新資訊」modal. Newest first. Keep entries
// short and in plain language (團主 audience).
import i18n from '../i18n'

export interface ChangelogEntry {
  date: string
  items: string[]
}

// Release dates + how many bullet items each release has, newest first. The item
// text lives in the changelog locale fragments (keys `changelog.<key>.i<item>`)
// and is read at call time so it follows the current language. `key` is explicit
// (not the array index) so adding a newer release on top is a pure append to the
// locale files — no renumbering of every existing key.
const RELEASES: { date: string; count: number; key: string }[] = [
  { date: '2026/07/17', count: 1, key: 'r6' },
  { date: '2026/07/11', count: 4, key: 'r0' },
  { date: '2026/07/06', count: 1, key: 'r1' },
  { date: '2026/07/05', count: 2, key: 'r2' },
  { date: '2026/07/03', count: 5, key: 'r3' },
  { date: '2026/06/30', count: 2, key: 'r4' },
  { date: '2026/06/29', count: 11, key: 'r5' },
]

// Localized changelog. Call inside a render so it re-reads on language change.
export function getChangelog(): ChangelogEntry[] {
  return RELEASES.map((r) => ({
    date: r.date,
    items: Array.from({ length: r.count }, (_, ii) => i18n.t(`changelog.${r.key}.i${ii}`)),
  }))
}
