import React, { createContext, useContext, useEffect, useReducer, useCallback, useRef } from 'react'
import type { AppState, User, Trip, TripExpense, LocalSettings } from '../types'
import { USER_COLORS } from '../types'
import { loadState, saveState, saveAuth } from '../utils/storage'
import { generateId } from '../utils/id'
import { convertToDefault } from '../utils/currency'
import {
  initFirebase,
  isFirebaseConfigured,
  subscribeToUsers,
  subscribeToTrips,
  subscribeToTripExpenses,
  subscribeToExchangeRates,
  syncUser,
  syncTrip,
  deleteTripFromFirestore,
  syncTripExpense,
  deleteTripExpenseFromFirestore,
  syncExchangeRates,
} from '../utils/firebase'
import type { Firestore } from 'firebase/firestore'

type Action =
  | { type: 'SET_USERS'; users: User[] }
  | { type: 'ADD_USER'; user: User }
  | { type: 'UPDATE_USER'; user: User }
  | { type: 'SET_TRIPS'; trips: Trip[] }
  | { type: 'ADD_TRIP'; trip: Trip }
  | { type: 'UPDATE_TRIP'; trip: Trip }
  | { type: 'DELETE_TRIP'; id: string }
  | { type: 'SET_EXPENSES'; expenses: TripExpense[] }
  | { type: 'ADD_EXPENSE'; expense: TripExpense }
  | { type: 'UPDATE_EXPENSE'; expense: TripExpense }
  | { type: 'DELETE_EXPENSE'; id: string }
  | { type: 'SET_EXCHANGE_RATES'; rates: Record<string, number> }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<LocalSettings> }
  | { type: 'LOGIN'; user: User }
  | { type: 'LOGOUT' }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_USERS': {
      const users = action.users.map((u, i) =>
        u.color ? u : { ...u, color: USER_COLORS[i % USER_COLORS.length] }
      )
      return { ...state, users }
    }
    case 'ADD_USER':
      return { ...state, users: [...state.users, action.user] }
    case 'UPDATE_USER':
      return {
        ...state,
        users: state.users.map((u) => (u.id === action.user.id ? action.user : u)),
        auth: state.auth.currentUser?.id === action.user.id
          ? { currentUser: action.user }
          : state.auth,
      }
    case 'SET_TRIPS':
      return { ...state, trips: action.trips }
    case 'ADD_TRIP':
      return { ...state, trips: [action.trip, ...state.trips] }
    case 'UPDATE_TRIP':
      return {
        ...state,
        trips: state.trips.map((t) => (t.id === action.trip.id ? action.trip : t)),
      }
    case 'DELETE_TRIP':
      return {
        ...state,
        trips: state.trips.filter((t) => t.id !== action.id),
        expenses: state.expenses.filter((e) => e.tripId !== action.id),
      }
    case 'SET_EXPENSES':
      return { ...state, expenses: action.expenses }
    case 'ADD_EXPENSE':
      return { ...state, expenses: [action.expense, ...state.expenses] }
    case 'UPDATE_EXPENSE':
      return {
        ...state,
        expenses: state.expenses.map((e) =>
          e.id === action.expense.id ? action.expense : e
        ),
      }
    case 'DELETE_EXPENSE':
      return {
        ...state,
        expenses: state.expenses.filter((e) => e.id !== action.id),
      }
    case 'SET_EXCHANGE_RATES':
      return { ...state, exchangeRates: action.rates }
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.settings } }
    case 'LOGIN':
      return { ...state, auth: { currentUser: action.user } }
    case 'LOGOUT':
      return { ...state, auth: { currentUser: null } }
    default:
      return state
  }
}

interface AppContextValue {
  state: AppState
  login: (user: User) => void
  logout: () => void
  register: (username: string, password: string, displayName: string) => Promise<User>
  updateUser: (user: User) => void
  deleteUser: (id: string) => void
  addTrip: (name: string, primaryCurrency: string, memberIds: string[]) => void
  updateTrip: (trip: Trip) => void
  deleteTrip: (id: string) => void
  addExpense: (data: Omit<TripExpense, 'id' | 'updatedAt' | 'convertedAmount' | 'exchangeRate'> & { currency: string }) => void
  updateExpense: (expense: TripExpense) => void
  deleteExpense: (id: string) => void
  updateExchangeRates: (rates: Record<string, number>) => void
  updateSettings: (settings: Partial<LocalSettings>) => void
  getUserName: (userId: string) => string
  getUserColor: (userId: string) => string
  getTripExpenses: (tripId: string) => TripExpense[]
  getTripMembers: (trip: Trip) => User[]
  isCurrentUserAdmin: () => boolean
  isTripManager: (trip: Trip) => boolean
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)
  const dbRef = useRef<Firestore | null>(null)
  const firebaseListeningRef = useRef(false)

  // Initialize Firebase
  useEffect(() => {
    if (isFirebaseConfigured() && !firebaseListeningRef.current) {
      const db = initFirebase()
      dbRef.current = db
      if (db) {
        firebaseListeningRef.current = true
        const unsub1 = subscribeToUsers(db, (users) => dispatch({ type: 'SET_USERS', users }))
        const unsub2 = subscribeToTrips(db, (trips) => dispatch({ type: 'SET_TRIPS', trips }))
        const unsub3 = subscribeToTripExpenses(db, (expenses) => dispatch({ type: 'SET_EXPENSES', expenses }))
        const unsub4 = subscribeToExchangeRates(db, (rates) => dispatch({ type: 'SET_EXCHANGE_RATES', rates }))
        return () => {
          unsub1()
          unsub2()
          unsub3()
          unsub4()
          firebaseListeningRef.current = false
        }
      }
    }
  }, [])

  // Save to localStorage on state change
  useEffect(() => {
    saveState(state)
  }, [state])

  const login = useCallback((user: User) => {
    dispatch({ type: 'LOGIN', user })
    saveAuth(user)
  }, [])

  const logout = useCallback(() => {
    dispatch({ type: 'LOGOUT' })
    saveAuth(null)
  }, [])

  const register = useCallback(async (username: string, password: string, displayName: string): Promise<User> => {
    const isFirstUser = state.users.length === 0
    const usedColors = state.users.map((u) => u.color)
    const available = USER_COLORS.filter((c) => !usedColors.includes(c))
    const colorPool = available.length > 0 ? available : USER_COLORS
    const color = colorPool[Math.floor(Math.random() * colorPool.length)]
    const user: User = {
      id: generateId(),
      username,
      password,
      displayName,
      color,
      isAdmin: isFirstUser,
      createdAt: new Date().toISOString(),
    }
    dispatch({ type: 'ADD_USER', user })
    if (dbRef.current) await syncUser(dbRef.current, user)
    return user
  }, [])

  const updateUser = useCallback((user: User) => {
    dispatch({ type: 'UPDATE_USER', user })
    if (user.id === state.auth.currentUser?.id) saveAuth(user)
    if (dbRef.current) syncUser(dbRef.current, user)
  }, [state.auth.currentUser])

  const deleteUser = useCallback((id: string) => {
    const user = state.users.find((u) => u.id === id)
    if (!user) return
    const deleted = { ...user, deleted: true }
    dispatch({ type: 'UPDATE_USER', user: deleted })
    if (dbRef.current) syncUser(dbRef.current, deleted)
  }, [state.users])

  const addTrip = useCallback((name: string, primaryCurrency: string, memberIds: string[]) => {
    if (!state.auth.currentUser) return
    const now = new Date().toISOString()
    const trip: Trip = {
      id: generateId(),
      name,
      primaryCurrency,
      members: memberIds,
      creator: state.auth.currentUser.id,
      archived: false,
      createdAt: now,
      updatedAt: now,
    }
    dispatch({ type: 'ADD_TRIP', trip })
    if (dbRef.current) syncTrip(dbRef.current, trip)
  }, [state.auth.currentUser])

  const updateTripAction = useCallback((trip: Trip) => {
    const updated = { ...trip, updatedAt: new Date().toISOString() }
    dispatch({ type: 'UPDATE_TRIP', trip: updated })
    if (dbRef.current) syncTrip(dbRef.current, updated)
  }, [])

  const deleteTripAction = useCallback((id: string) => {
    // Delete trip and its expenses
    const tripExpenses = state.expenses.filter((e) => e.tripId === id)
    dispatch({ type: 'DELETE_TRIP', id })
    if (dbRef.current) {
      deleteTripFromFirestore(dbRef.current, id)
      tripExpenses.forEach((e) => deleteTripExpenseFromFirestore(dbRef.current!, e.id))
    }
  }, [state.expenses])

  const addExpense = useCallback((data: Omit<TripExpense, 'id' | 'updatedAt' | 'convertedAmount' | 'exchangeRate'> & { currency: string }) => {
    const trip = state.trips.find((t) => t.id === data.tripId)
    if (!trip) return
    const { convertedAmount, exchangeRate } = convertToDefault(
      data.amount,
      data.currency,
      trip.primaryCurrency,
      state.exchangeRates
    )
    const now = new Date().toISOString()
    const expense: TripExpense = {
      ...data,
      id: generateId(),
      convertedAmount,
      exchangeRate,
      createdAt: now,
      updatedAt: now,
    }
    dispatch({ type: 'ADD_EXPENSE', expense })
    if (dbRef.current) syncTripExpense(dbRef.current, expense)
  }, [state.trips, state.exchangeRates])

  const updateExpense = useCallback((expense: TripExpense) => {
    const trip = state.trips.find((t) => t.id === expense.tripId)
    if (!trip) return
    const { convertedAmount, exchangeRate } = convertToDefault(
      expense.amount,
      expense.currency,
      trip.primaryCurrency,
      state.exchangeRates
    )
    const updated = {
      ...expense,
      convertedAmount,
      exchangeRate,
      updatedAt: new Date().toISOString(),
    }
    dispatch({ type: 'UPDATE_EXPENSE', expense: updated })
    if (dbRef.current) syncTripExpense(dbRef.current, updated)
  }, [state.trips, state.exchangeRates])

  const deleteExpense = useCallback((id: string) => {
    dispatch({ type: 'DELETE_EXPENSE', id })
    if (dbRef.current) deleteTripExpenseFromFirestore(dbRef.current, id)
  }, [])

  const updateExchangeRates = useCallback((rates: Record<string, number>) => {
    dispatch({ type: 'SET_EXCHANGE_RATES', rates })
    if (dbRef.current) syncExchangeRates(dbRef.current, rates)
  }, [])

  const updateSettings = useCallback((settings: Partial<LocalSettings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', settings })
  }, [])

  const getUserName = useCallback((userId: string): string => {
    const user = state.users.find((u) => u.id === userId)
    return user?.displayName || '未知'
  }, [state.users])

  const getUserColor = useCallback((userId: string): string => {
    const user = state.users.find((u) => u.id === userId)
    return user?.color || '#888'
  }, [state.users])

  const getTripExpenses = useCallback((tripId: string): TripExpense[] => {
    return state.expenses.filter((e) => e.tripId === tripId)
  }, [state.expenses])

  const getTripMembers = useCallback((trip: Trip): User[] => {
    return trip.members
      .map((id) => state.users.find((u) => u.id === id))
      .filter((u): u is User => u !== undefined)
  }, [state.users])

  const isCurrentUserAdmin = useCallback((): boolean => {
    const user = state.auth.currentUser
    if (!user) return false
    if (user.isAdmin) return true
    // Fallback: the earliest registered user is admin
    const sorted = [...state.users].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return sorted.length > 0 && sorted[0].id === user.id
  }, [state.auth.currentUser, state.users])

  const isTripManager = useCallback((trip: Trip): boolean => {
    const user = state.auth.currentUser
    if (!user) return false
    return trip.managerId === user.id && trip.members.includes(user.id)
  }, [state.auth.currentUser])

  return (
    <AppContext.Provider
      value={{
        state,
        login,
        logout,
        register,
        updateUser,
        deleteUser,
        addTrip,
        updateTrip: updateTripAction,
        deleteTrip: deleteTripAction,
        addExpense,
        updateExpense,
        deleteExpense,
        updateExchangeRates,
        updateSettings,
        getUserName,
        getUserColor,
        getTripExpenses,
        getTripMembers,
        isCurrentUserAdmin,
        isTripManager,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within AppProvider')
  return context
}
