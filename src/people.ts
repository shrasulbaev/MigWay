export type Gender = 'm' | 'f'
export type Goal = 'serious' | 'chat' | 'friends'

const HUES = [158, 200, 24, 280, 340, 46, 186, 12]

// Цветной фон для аватара без фото: стабильный для каждого пользователя.
export function avatarStyle(p: { id: string; gender?: Gender | null; avatar_url?: string | null }) {
  if (p.avatar_url) return { backgroundImage: `url(${p.avatar_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  let sum = 0
  for (const ch of p.id) sum = (sum + ch.charCodeAt(0)) % 997
  const hue = HUES[sum % HUES.length] + (p.gender === 'f' ? 0 : 20)
  return { background: `linear-gradient(150deg, hsl(${hue} 70% 82%), hsl(${hue + 25} 55% 62%))` }
}

export function ageOf(birthYear: number | null | undefined): number | null {
  return birthYear ? new Date().getFullYear() - birthYear : null
}
