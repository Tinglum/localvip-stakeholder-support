import { NextResponse } from 'next/server'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { requireQaRouteAccess, qaRouteErrorResponse } from '@/lib/server/qa-route'

// The QA mobile transactions endpoint for the logged-in consumer.
// Confirmed against App/Controllers/Mobile/PaymentController.cs
// ([HttpGet("transactions")] on the mobile Payment controller).
const QA_TRANSACTIONS_ENDPOINT = '/api/mobile/v1/Payment/transactions'

// Mirrors Ten10.App.Models.ViewModelsMobile.TransactionModel.
export interface PortalTransaction {
  id: number
  title: string | null
  amount: number
  tip: number
  cashback: number
  walletAmount: number
  transactionStatus: string | null
  transactionType: string | null
  dateTime: string | null
}

type RawTransaction = {
  Id?: number | string
  id?: number | string
  Title?: string | null
  title?: string | null
  Amount?: number | string
  amount?: number | string
  Tip?: number | string
  tip?: number | string
  Cashback?: number | string
  cashback?: number | string
  WalletAmount?: number | string
  walletAmount?: number | string
  TransactionStatus?: string | null
  transactionStatus?: string | null
  TransactionType?: string | null
  transactionType?: string | null
  DateTime?: string | null
  dateTime?: string | null
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function normalize(raw: RawTransaction, index: number): PortalTransaction {
  return {
    id: Number(raw.Id ?? raw.id ?? index),
    title: raw.Title ?? raw.title ?? null,
    amount: toNumber(raw.Amount ?? raw.amount),
    tip: toNumber(raw.Tip ?? raw.tip),
    cashback: toNumber(raw.Cashback ?? raw.cashback),
    walletAmount: toNumber(raw.WalletAmount ?? raw.walletAmount),
    transactionStatus: raw.TransactionStatus ?? raw.transactionStatus ?? null,
    transactionType: raw.TransactionType ?? raw.transactionType ?? null,
    dateTime: raw.DateTime ?? raw.dateTime ?? null,
  }
}

export async function GET() {
  // Consumer self-service portal: allow only the consumer shell.
  const access = await requireQaRouteAccess(['consumer'])
  if ('error' in access) return access.error

  try {
    const response = await fetchQaApi(QA_TRANSACTIONS_ENDPOINT)
    const payload = await parseQaResponse<RawTransaction[]>(
      response,
      'The transactions request failed.',
    )

    const rows = Array.isArray(payload) ? payload : []
    const transactions = rows.map(normalize)

    return NextResponse.json({
      ok: true,
      endpoint: QA_TRANSACTIONS_ENDPOINT,
      count: transactions.length,
      transactions,
    })
  } catch (error) {
    return qaRouteErrorResponse(error, 'The transactions request failed.')
  }
}
