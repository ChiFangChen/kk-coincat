export interface User {
  id: string
  username: string
  password: string
  displayName: string
  color: string
  isAdmin: boolean
  deleted?: boolean
  createdAt: string
}

export const USER_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16',
  '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
]

export interface Trip {
  id: string
  name: string
  primaryCurrency: string
  members: string[] // user IDs
  creator: string // user ID
  managerId?: string | null // user ID — designated trip manager (one per trip, set by admin)
  timezone: string // IANA timezone e.g. "Asia/Taipei"
  trackedCurrencies: string[] // currency codes tracked for this trip
  archived: boolean
  createdAt: string
  updatedAt: string
}

export type SplitMethod = 'equal' | 'ratio' | 'amount'

export interface SplitDetail {
  userId: string
  value: number // ratio weight or fixed amount
}

export interface TripExpense {
  id: string
  tripId: string
  payer: string // user ID
  amount: number
  item: string
  currency: string
  exchangeRate: number
  convertedAmount: number
  splitMethod: SplitMethod
  participants: string[] // user IDs
  splitDetails: SplitDetail[]
  isSettlement: boolean
  createdAt: string
  updatedAt: string
}

export interface TransferSuggestion {
  from: string // user ID
  to: string // user ID
  amount: number
}

export interface LocalSettings {
  theme: 'dark' | 'light'
}

export interface AuthState {
  currentUser: User | null
}

export interface AppState {
  auth: AuthState
  users: User[]
  trips: Trip[]
  expenses: TripExpense[]
  exchangeRates: Record<string, number>
  ratesSyncedAt: string | null
  timezones: string[]
  settings: LocalSettings
}
