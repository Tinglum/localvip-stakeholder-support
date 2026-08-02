export interface RippleReadiness {
  enabled: boolean
  ready: boolean
  checkedAtUtc: string
  outbox: {
    pending: number
    retrying: number
    deadLetter: number
    oldestPendingAtUtc: string | null
  }
  ledger: {
    unreconciledTransactions: number
  }
  schema: {
    rippleColumnAvailable: boolean
    snapshotsAvailable: boolean
    causeAllocationsAvailable: boolean
    outboxAvailable: boolean
  }
  blockers: string[]
  warnings: string[]
}

export interface RippleReconciliationIssue {
  code: string
  transactionId: number | null
  paymentIntentId: string | null
  expectedCents: number | null
  actualCents: number | null
  detail: string
}

export interface RippleReconciliation {
  checkedAtUtc: string
  period: unknown
  summary: {
    transactions: number
    missingSnapshots: number
    feeMismatches: number
    causeMismatches: number
    duplicatePaymentIntents: number
    orphanedLedgerRows: number
  }
  issues: RippleReconciliationIssue[]
  truncated: boolean
}

export interface RippleEnabledUpdate {
  enabled: boolean
  updatedOn: string
  updatedBy: string
}
