export interface User {
  id: string
  username: string
  password: string
  displayName: string
  isAdmin: boolean
  createdAt: string
}

export interface Trip {
  id: string
  name: string
  primaryCurrency: string
  members: string[] // user IDs
  creator: string // user ID
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
  settings: LocalSettings
}
