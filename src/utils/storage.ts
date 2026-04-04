import type { AppState, LocalSettings, User } from '../types'
import { USER_COLORS } from '../types'

const STORAGE_KEY = 'kk-coincat-data'
const AUTH_KEY = 'kk-coincat-auth'
const SETTINGS_KEY = 'kk-coincat-settings'
const EXPENSE_PREFS_PREFIX = 'kk-coincat-expense-prefs-'

export const defaultSettings: LocalSettings = {
  theme: 'light',
}

export const defaultState: AppState = {
  auth: { currentUser: null },
  users: [],
  trips: [],
  expenses: [],
  exchangeRates: {},
  timezones: [],
  settings: defaultSettings,
}

export function loadState(): AppState {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    const auth = localStorage.getItem(AUTH_KEY)
    const settings = localStorage.getItem(SETTINGS_KEY)

    const parsed = data ? JSON.parse(data) as Partial<AppState> : {}
    const parsedAuth = auth ? JSON.parse(auth) as { currentUser: User | null } : { currentUser: null }
    const parsedSettings = settings ? JSON.parse(settings) as Partial<LocalSettings> : {}

    // Migrate users without color
    const users = (parsed.users || []).map((u: User, i: number) => {
      if (!u.color) return { ...u, color: USER_COLORS[i % USER_COLORS.length] }
      return u
    })
    const authUser = parsedAuth.currentUser
    if (authUser && !authUser.color) {
      const match = users.find((u: User) => u.id === authUser.id)
      if (match) parsedAuth.currentUser = match
    }

    return {
      ...defaultState,
      ...parsed,
      users,
      auth: parsedAuth,
      settings: { ...defaultSettings, ...parsedSettings },
    }
  } catch {
    return defaultState
  }
}

export function saveState(state: AppState): void {
  const { auth, settings, ...rest } = state
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rest))
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth))
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function saveAuth(currentUser: User | null): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ currentUser }))
}

export function clearAuth(): void {
  localStorage.removeItem(AUTH_KEY)
}

export interface ExpensePrefs {
  splitMethod: string
  participants: string[]
  currency?: string
}

export function loadExpensePrefs(tripId: string): ExpensePrefs | null {
  try {
    const data = localStorage.getItem(EXPENSE_PREFS_PREFIX + tripId)
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

export function saveExpensePrefs(tripId: string, prefs: ExpensePrefs): void {
  localStorage.setItem(EXPENSE_PREFS_PREFIX + tripId, JSON.stringify(prefs))
}
