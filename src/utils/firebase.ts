import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
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
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

let app: FirebaseApp | null = null
let db: Firestore | null = null

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)
}

export async function initFirebase(): Promise<Firestore | null> {
  if (!isFirebaseConfigured()) return null
  if (db) return db
  try {
    app = initializeApp(firebaseConfig)
    const auth = getAuth(app)
    await signInAnonymously(auth)
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

export async function syncTripPartial(db: Firestore, tripId: string, fields: Record<string, unknown>): Promise<void> {
  const { updateDoc } = await import('firebase/firestore')
  await updateDoc(doc(db, 'ccTrips', tripId), fields)
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
  callback: (rates: Record<string, number>, ratesSyncedAt: string | null) => void
): () => void {
  return onSnapshot(doc(db, 'app', 'settings'), (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data()
      callback(data.exchangeRates || {}, data.ratesSyncedAt || null)
    }
  })
}

export async function syncExchangeRates(db: Firestore, rates: Record<string, number>): Promise<void> {
  const ref = doc(db, 'app', 'settings')
  await setDoc(ref, { exchangeRates: rates, ratesSyncedAt: new Date().toISOString() }, { merge: true })
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
