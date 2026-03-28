import { splitFullName } from '@/lib/business-portal'

export const IMPORT_IGNORE = '__ignore__'

export type BusinessContactImportField =
  | 'name'
  | 'first_name'
  | 'last_name'
  | 'phone'
  | 'email'
  | 'tag'

export interface ParsedContactSheet {
  headers: string[]
  rows: string[][]
  delimiter: 'tab' | 'comma' | 'semicolon'
}

export type ContactImportMapping = Record<BusinessContactImportField, string>

export interface ContactImportPreviewRow {
  rowNumber: number
  source: string[]
  fullName: string
  firstName: string
  lastName: string
  phone: string
  email: string
  tag: string
  isReady: boolean
  issue: string | null
}

function countDelimiter(line: string, delimiter: string) {
  let count = 0
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        index += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (!inQuotes && char === delimiter) {
      count += 1
    }
  }

  return count
}

function detectDelimiter(text: string): ParsedContactSheet['delimiter'] {
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || ''

  const candidates: Array<{ key: ParsedContactSheet['delimiter']; value: string }> = [
    { key: 'tab', value: '\t' },
    { key: 'comma', value: ',' },
    { key: 'semicolon', value: ';' },
  ]

  const winner = candidates
    .map((candidate) => ({ ...candidate, count: countDelimiter(firstLine, candidate.value) }))
    .sort((left, right) => right.count - left.count)[0]

  return winner && winner.count > 0 ? winner.key : 'comma'
}

function getDelimiterCharacter(delimiter: ParsedContactSheet['delimiter']) {
  if (delimiter === 'tab') return '\t'
  if (delimiter === 'semicolon') return ';'
  return ','
}

function parseDelimitedMatrix(text: string, delimiter: string) {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const nextChar = text[index + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (!inQuotes && char === delimiter) {
      currentRow.push(currentCell.trim())
      currentCell = ''
      continue
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && nextChar === '\n') {
        index += 1
      }

      currentRow.push(currentCell.trim())
      currentCell = ''

      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow)
      }

      currentRow = []
      continue
    }

    currentCell += char
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim())
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow)
    }
  }

  return rows
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function headerMatches(header: string, candidates: string[]) {
  return candidates.includes(normalizeHeader(header))
}

function guessField(header: string): BusinessContactImportField | null {
  if (headerMatches(header, ['name', 'full name', 'fullname', 'contact name', 'customer name'])) return 'name'
  if (headerMatches(header, ['first name', 'firstname', 'given name', 'forename'])) return 'first_name'
  if (headerMatches(header, ['last name', 'lastname', 'surname', 'family name'])) return 'last_name'
  if (headerMatches(header, ['phone', 'phone number', 'mobile', 'mobile number', 'cell', 'cell phone'])) return 'phone'
  if (headerMatches(header, ['email', 'email address', 'e mail', 'e-mail'])) return 'email'
  if (headerMatches(header, ['tag', 'tags', 'group', 'relationship', 'segment', 'type'])) return 'tag'
  return null
}

export function parseContactSheet(text: string): ParsedContactSheet {
  const cleanedText = text.replace(/\uFEFF/g, '').trim()
  if (!cleanedText) {
    return { headers: [], rows: [], delimiter: 'comma' }
  }

  const delimiter = detectDelimiter(cleanedText)
  const matrix = parseDelimitedMatrix(cleanedText, getDelimiterCharacter(delimiter))

  if (!matrix.length) {
    return { headers: [], rows: [], delimiter }
  }

  const [headerRow, ...bodyRows] = matrix
  const headerCount = headerRow.length
  const headers = headerRow.map((header, index) => header || `Column ${index + 1}`)
  const rows = bodyRows
    .filter((row) => row.some((value) => value.trim().length > 0))
    .map((row) => Array.from({ length: headerCount }, (_, index) => row[index] || ''))

  return {
    headers,
    rows,
    delimiter,
  }
}

export function autoMapContactColumns(headers: string[]): ContactImportMapping {
  const nextMapping: ContactImportMapping = {
    name: IMPORT_IGNORE,
    first_name: IMPORT_IGNORE,
    last_name: IMPORT_IGNORE,
    phone: IMPORT_IGNORE,
    email: IMPORT_IGNORE,
    tag: IMPORT_IGNORE,
  }

  headers.forEach((header, index) => {
    const guessedField = guessField(header)
    if (guessedField && nextMapping[guessedField] === IMPORT_IGNORE) {
      nextMapping[guessedField] = String(index)
    }
  })

  return nextMapping
}

function getMappedValue(row: string[], mappingValue: string) {
  if (mappingValue === IMPORT_IGNORE) return ''
  const index = Number(mappingValue)
  if (Number.isNaN(index)) return ''
  return (row[index] || '').trim()
}

export function buildContactImportPreview(
  parsedSheet: ParsedContactSheet,
  mapping: ContactImportMapping,
): ContactImportPreviewRow[] {
  return parsedSheet.rows.map((row, rowIndex) => {
    const directName = getMappedValue(row, mapping.name)
    const mappedFirstName = getMappedValue(row, mapping.first_name)
    const mappedLastName = getMappedValue(row, mapping.last_name)
    const phone = getMappedValue(row, mapping.phone)
    const email = getMappedValue(row, mapping.email)
    const tag = getMappedValue(row, mapping.tag)

    const derivedName = directName || [mappedFirstName, mappedLastName].filter(Boolean).join(' ').trim()
    const splitName = splitFullName(derivedName)
    const firstName = directName ? splitName.first_name : mappedFirstName
    const lastName = directName ? splitName.last_name : mappedLastName
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()

    let issue: string | null = null
    if (!fullName) {
      issue = 'Missing name'
    } else if (!phone && !email) {
      issue = 'Missing phone and email'
    }

    return {
      rowNumber: rowIndex + 2,
      source: row,
      fullName,
      firstName,
      lastName,
      phone,
      email,
      tag,
      isReady: !issue,
      issue,
    }
  })
}
