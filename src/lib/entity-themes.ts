export type EntityThemeKind = 'business' | 'cause' | 'city'

interface EntityTheme {
  icon: string
  surface: string
  softSurface: string
  border: string
  text: string
  mutedText: string
  badge: string
  ring: string
  gradient: string
}

export const ENTITY_THEMES: Record<EntityThemeKind, EntityTheme> = {
  business: {
    icon: 'bg-gradient-to-br from-[#d7e200] via-[#e5f000] to-[#b8c500] text-surface-950',
    surface: 'bg-gradient-to-br from-[#fbfdd9] via-white to-[#f6fac1]',
    softSurface: 'bg-[#f6fac1]',
    border: 'border-[#d7e200]',
    text: 'text-[#556100]',
    mutedText: 'text-[#728000]',
    badge: 'bg-[#f6fac1] text-[#556100]',
    ring: 'ring-[#eef5a5]',
    gradient: 'from-[#d7e200]/20 via-[#eef5a5]/10 to-[#b8c500]/20',
  },
  cause: {
    icon: 'bg-gradient-to-br from-pink-500 via-pink-500 to-rose-500 text-white',
    surface: 'bg-gradient-to-br from-pink-50 via-white to-rose-50',
    softSurface: 'bg-pink-50',
    border: 'border-pink-200',
    text: 'text-pink-900',
    mutedText: 'text-pink-700',
    badge: 'bg-pink-100 text-pink-800',
    ring: 'ring-pink-100',
    gradient: 'from-pink-500/15 via-pink-300/5 to-rose-400/15',
  },
  city: {
    icon: 'bg-gradient-to-br from-surface-700 via-surface-800 to-surface-900 text-white',
    surface: 'bg-gradient-to-br from-surface-50 via-white to-surface-100',
    softSurface: 'bg-surface-50',
    border: 'border-surface-200',
    text: 'text-surface-900',
    mutedText: 'text-surface-600',
    badge: 'bg-surface-100 text-surface-700',
    ring: 'ring-surface-100',
    gradient: 'from-surface-900/10 via-surface-100/10 to-surface-300/20',
  },
}

export function getEntityTheme(kind: EntityThemeKind) {
  return ENTITY_THEMES[kind]
}
