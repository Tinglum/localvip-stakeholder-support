// Shared Bug Center types. Mirrors the QA Bug Center API contract
// (https://qa.localvip.com /api/dashboard/v1/BugReport*).

export type BugPriority = 'nice' | 'need' | 'urgent'
export type BugCategory = 'ui_ux' | 'code' | 'functionality'
export type BugStatus = 'open' | 'in_progress' | 'resolved' | 'wont_fix'
export type BugApp = 'dashboard' | 'webapp'

export interface BugReportSettings {
  enabledDashboard: boolean
  enabledWebapp: boolean
}

/** Body for POST /BugReport (create). */
export interface BugReportCreateInput {
  app: BugApp
  whatWrong: string
  expectedBehavior: string
  priority: BugPriority
  category: BugCategory
  pageUrl: string
  userAgent: string
  viewport: string
  /** JSON string of captured console errors. */
  consoleErrors: string
  /** JSON string of captured failed network requests. */
  networkErrors: string
  /** data:image/png;base64,... */
  screenshotBase64: string
}

export interface BugReportNote {
  id?: number | string
  authorUserId?: number | string | null
  authorName?: string | null
  text: string
  createdAt?: string | null
}

export interface BugReport {
  id: number | string
  app: BugApp | string
  whatWrong: string
  expectedBehavior: string | null
  priority: BugPriority | string
  category: BugCategory | string
  status: BugStatus | string
  pageUrl: string | null
  userAgent: string | null
  viewport: string | null
  consoleErrors: string | null
  networkErrors: string | null
  screenshotUrl: string | null
  assigneeUserId: number | string | null
  assigneeName?: string | null
  tags: string[] | null
  notes?: BugReportNote[] | null
  reporterUserId?: number | string | null
  reporterName?: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface BugReportListResponse {
  items: BugReport[]
  totalCount: number
  page: number
  pageSize: number
}

export interface BugReportListQuery {
  priority?: BugPriority | ''
  category?: BugCategory | ''
  status?: BugStatus | ''
  app?: BugApp | ''
  search?: string
  page?: number
  pageSize?: number
}

export interface BugReportUpdateInput {
  status?: BugStatus
  priority?: BugPriority
  category?: BugCategory
  assigneeUserId?: number | string | null
  tags?: string[]
  /** Appended to the notes/comments thread. */
  note?: string
}

export interface BugReportStats {
  total: number
  byPriority: Record<string, number>
  byStatus: Record<string, number>
  byCategory: Record<string, number>
  byApp?: Record<string, number>
}

export const PRIORITY_META: Record<BugPriority, { label: string; short: string }> = {
  nice: { label: 'Nice to have', short: 'Nice' },
  need: { label: 'Need to have', short: 'Need' },
  urgent: { label: 'URGENT', short: 'Urgent' },
}

export const CATEGORY_META: Record<BugCategory, { label: string }> = {
  ui_ux: { label: 'UI / UX' },
  code: { label: 'Code' },
  functionality: { label: 'Functionality' },
}

export const STATUS_META: Record<BugStatus, { label: string }> = {
  open: { label: 'Open' },
  in_progress: { label: 'In progress' },
  resolved: { label: 'Resolved' },
  wont_fix: { label: "Won't fix" },
}

export const PRIORITY_ORDER: BugPriority[] = ['nice', 'need', 'urgent']
export const CATEGORY_ORDER: BugCategory[] = ['ui_ux', 'code', 'functionality']
export const STATUS_ORDER: BugStatus[] = ['open', 'in_progress', 'resolved', 'wont_fix']
