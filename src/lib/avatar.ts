// avatars are stored as a short string: a photo URL (Google/LINE) OR a chosen
// emoji. No images are stored anywhere — zero storage cost.
export const AVATAR_EMOJIS = [
  '🦊', '🐱', '🐼', '🦁', '🐯', '🐸', '🐶', '🐵',
  '🐰', '🐨', '🦄', '🐧', '🐢', '🐙', '🦖', '🐳',
  '🦉', '🐝', '🌟', '🔥', '🏸', '😎', '👻', '🤖',
]

export function isPhotoUrl(s?: string): boolean {
  return !!s && /^https?:\/\//.test(s)
}
