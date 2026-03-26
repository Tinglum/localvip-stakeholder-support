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
    icon: 'bg-gradient-to-br from-amber-400 via-amber-500 to-lime-500 text-white',
    surface: 'bg-gradient-to-br from-amber-50 via-white to-lime-50',
    softSurface: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-900',
    mutedText: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-800',
    ring: 'ring-amber-100',
    gradient: 'from-amber-500/15 via-amber-300/5 to-lime-400/15',
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

