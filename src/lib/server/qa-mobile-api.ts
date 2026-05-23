import { fetchQaApi, parseQaJsonResponse, parseQaResponse } from '@/lib/auth/qa-api'

export interface TransactionModel {
  id: number
  title: string
  amount: number
  tip: number
  cashback: number
  walletAmount: number
  transactionStatus: string
  transactionType: string
  dateTime: string
}

export interface CashbackModel {
  amount: number
  date: string
  title: string
}

export interface BonusCashModel {
  amount: number
  date: string
}

export interface WalletMobile {
  id: number
  prevAmount: number
  addedAmount: number
  currentAmount: number
  availableAmount: number
  walletStatus: string
  bank: string
  walletYear: number
  walletMonth: number
  walletDay: number
  createdOn: string
  minimumWithdraw: number
  withdrawCharge: number
}

export async function fetchTransactions(): Promise<TransactionModel[]> {
  const res = await fetchQaApi('/api/mobile/v1/Payment/transactions')
  return parseQaJsonResponse<TransactionModel[]>(res, 'Failed to load transactions.')
}

export async function fetchTransactionsByMonth(year: number, month: number): Promise<TransactionModel[]> {
  const res = await fetchQaApi(`/api/mobile/v1/Payment/transactions/${year}/${month}`)
  return parseQaJsonResponse<TransactionModel[]>(res, 'Failed to load transactions.')
}

export async function fetchCashbackLifetime(): Promise<unknown> {
  const res = await fetchQaApi('/api/mobile/v1/Payment/cashback/lifetime')
  return parseQaResponse(res, 'Failed to load lifetime cashback.')
}

export async function fetchCashback(): Promise<CashbackModel[]> {
  const res = await fetchQaApi('/api/mobile/v1/Payment/cashback')
  return parseQaJsonResponse<CashbackModel[]>(res, 'Failed to load cashback.')
}

export async function fetchCashbackByMonth(year: number, month: number): Promise<CashbackModel[]> {
  const res = await fetchQaApi(`/api/mobile/v1/Payment/cashback/${year}/${month}`)
  return parseQaJsonResponse<CashbackModel[]>(res, 'Failed to load cashback.')
}

export async function fetchBonusCashLifetime(): Promise<unknown> {
  const res = await fetchQaApi('/api/mobile/v1/Payment/bonuscash/lifetime')
  return parseQaResponse(res, 'Failed to load lifetime bonus cash.')
}

export async function fetchBonusCash(): Promise<BonusCashModel[]> {
  const res = await fetchQaApi('/api/mobile/v1/Payment/bonuscash')
  return parseQaJsonResponse<BonusCashModel[]>(res, 'Failed to load bonus cash.')
}

export async function fetchBonusCashByMonth(year: number, month: number): Promise<BonusCashModel[]> {
  const res = await fetchQaApi(`/api/mobile/v1/Payment/bonuscash/${year}/${month}`)
  return parseQaJsonResponse<BonusCashModel[]>(res, 'Failed to load bonus cash.')
}

export async function fetchSocialImpact(): Promise<unknown> {
  const res = await fetchQaApi('/api/mobile/v1/Payment/socialImpact')
  return parseQaResponse(res, 'Failed to load social impact.')
}

export async function fetchSocialImpactFriends(): Promise<unknown> {
  const res = await fetchQaApi('/api/mobile/v1/Payment/socialImpactFriends')
  return parseQaResponse(res, 'Failed to load friends social impact.')
}

export async function fetchCausesList(): Promise<string[]> {
  const res = await fetchQaApi('/api/mobile/v1/Payment/10CausesList')
  return parseQaJsonResponse<string[]>(res, 'Failed to load causes list.')
}

export async function fetchFriendList(): Promise<string[]> {
  const res = await fetchQaApi('/api/mobile/v1/Payment/FiveFriendList')
  return parseQaJsonResponse<string[]>(res, 'Failed to load friend list.')
}

export async function fetchWallet(): Promise<WalletMobile> {
  const res = await fetchQaApi('/api/mobile/v1/Wallet/available')
  return parseQaJsonResponse<WalletMobile>(res, 'Failed to load wallet.')
}
