export const EMPTY_UUID = '00000000-0000-0000-0000-000000000000'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

export function asUuid(value: unknown): string | null {
  return isUuid(value) ? value : null
}

export function pickFirstUuid(...values: unknown[]): string | null {
  for (const value of values) {
    const uuid = asUuid(value)
    if (uuid) return uuid
  }
  return null
}
