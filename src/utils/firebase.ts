import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  type Firestore,
} from 'firebase/firestore'
import type { User, Trip, TripExpense } from '../types'

const firebaseConfig = {
  apiKey: 'AIzaSyCCCjlZZAUnoAxtv5km6Xw820YzTgJDix4',
  authDomain: 'k-w-balance-expense.firebaseapp.com',
  projectId: 'k-w-balance-expense',
  storageBucket: 'k-w-balance-expense.firebasestorage.app',
  messagingSenderId: '989568266987',
  appId: '1:989568266987:web:fad2d50a0f5cef96e9c4ae',
}

let app: FirebaseApp | null = null
let db: Firestore | null = null

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)
}

export function initFirebase(): Firestore | null {
  if (!isFirebaseConfigured()) return null
  if (db) return db
  try {
    app = initializeApp(firebaseConfig)
    db = getFirestore(app)
    return db
  } catch (error) {
    console.error('Firebase init failed:', error)
    return null
  }
}

// --- Users ---

export function subscribeToUsers(
  db: Firestore,
  callback: (users: User[]) => void
): () => void {
  return onSnapshot(collection(db, 'ccUsers'), (snapshot) => {
    const users = snapshot.docs.map((doc) => doc.data() as User)
    users.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    callback(users)
  })
}

export async function syncUser(db: Firestore, user: User): Promise<void> {
  await setDoc(doc(db, 'ccUsers', user.id), user)
}

export async function deleteUserFromFirestore(db: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(db, 'ccUsers', id))
}

export async function findUserByUsername(db: Firestore, username: string): Promise<User | null> {
  const q = query(collection(db, 'ccUsers'), where('username', '==', username))
  const snapshot = await getDocs(q)
  if (snapshot.empty) return null
  return snapshot.docs[0].data() as User
}

// --- Trips ---

export function subscribeToTrips(
  db: Firestore,
  callback: (trips: Trip[]) => void
): () => void {
  return onSnapshot(collection(db, 'ccTrips'), (snapshot) => {
    const trips = snapshot.docs.map((doc) => doc.data() as Trip)
    trips.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    callback(trips)
  })
}

export async function syncTrip(db: Firestore, trip: Trip): Promise<void> {
  await setDoc(doc(db, 'ccTrips', trip.id), trip, { merge: true })
}

export async function deleteTripFromFirestore(db: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(db, 'ccTrips', id))
}

// --- Trip Expenses ---

export function subscribeToTripExpenses(
  db: Firestore,
  callback: (expenses: TripExpense[]) => void
): () => void {
  return onSnapshot(collection(db, 'ccTripExpenses'), (snapshot) => {
    const expenses = snapshot.docs.map((doc) => doc.data() as TripExpense)
    expenses.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    callback(expenses)
  })
}

export async function syncTripExpense(db: Firestore, expense: TripExpense): Promise<void> {
  await setDoc(doc(db, 'ccTripExpenses', expense.id), expense)
}

export async function deleteTripExpenseFromFirestore(db: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(db, 'ccTripExpenses', id))
}

// --- Exchange Rates (shared with k-w-balance-expense) ---

export function subscribeToExchangeRates(
  db: Firestore,
  callback: (rates: Record<string, number>) => void
): () => void {
  return onSnapshot(doc(db, 'app', 'settings'), (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data()
      callback(data.exchangeRates || {})
    }
  })
}

export async function syncExchangeRates(db: Firestore, rates: Record<string, number>): Promise<void> {
  const { getDoc } = await import('firebase/firestore')
  const ref = doc(db, 'app', 'settings')
  const snapshot = await getDoc(ref)
  if (snapshot.exists()) {
    await setDoc(ref, { ...snapshot.data(), exchangeRates: rates }, { merge: true })
  } else {
    await setDoc(ref, { exchangeRates: rates })
  }
}

// --- Timezones ---

export function subscribeToTimezones(
  db: Firestore,
  callback: (timezones: string[]) => void
): () => void {
  return onSnapshot(doc(db, 'app', 'timezones'), (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data().list || [])
    }
  })
}

export async function syncTimezones(db: Firestore, timezones: string[]): Promise<void> {
  await setDoc(doc(db, 'app', 'timezones'), { list: timezones })
}
