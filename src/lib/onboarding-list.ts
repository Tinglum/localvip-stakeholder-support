export type OnboardingSort = 'alphabetical' | 'closest' | 'furthest'
export const ONBOARDING_SORT_LABELS = { alphabetical: 'Alphabetical (A–Z)', closest: 'Closest to completion', furthest: 'Furthest from completion' }
const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })
export function compareNames(a: { name: string }, b: { name: string }) { return collator.compare(a.name.trim(), b.name.trim()) }
export function sortOnboarding<T extends { id: string; name: string }>(items: T[], sort: OnboardingSort, progress: (item: T) => number): T[] {
  const scores = new Map(items.map(item => [item.id, sort === 'alphabetical' ? 0 : progress(item)]))
  return [...items].sort((a, b) => {
    const delta = (scores.get(a.id) || 0) - (scores.get(b.id) || 0)
    return (sort === 'closest' ? -delta : sort === 'furthest' ? delta : 0) || compareNames(a, b) || collator.compare(a.id, b.id)
  })
}
type LocationRecord = { city_id?: string | null; city?: string | null; city_name?: string | null; state?: string | null }
type City = { id: string; name: string; state: string }
const normalize = (value: string) => value.trim().toLowerCase()
export function onboardingLocation(item: LocationRecord, cities: City[]) {
  const linked = cities.find(city => String(city.id) === item.city_id)
  const name = (linked?.name || item.city || item.city_name || '').trim()
  const state = (linked?.state || item.state || '').trim()
  return { name, state, stateKey: normalize(state), key: name ? JSON.stringify([normalize(name), normalize(state)]) : 'missing' }
}
export function onboardingLocations(items: LocationRecord[], cities: City[]) {
  const unique = new Map<string, { id: string; name: string; state: string }>()
  items.forEach(item => { const location = onboardingLocation(item, cities); if (location.name) unique.set(location.key, { id: location.key, name: location.name, state: location.state }) })
  return [...unique.values()].sort((a,b) => compareNames(a,b) || collator.compare(a.state,b.state))
}
