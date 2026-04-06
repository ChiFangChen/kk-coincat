import type { TripExpense, SplitDetail, TransferSuggestion } from '../types'

/** Currencies with no decimal subunit */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'TWD', 'JPY', 'KRW', 'VND', 'IDR', 'CLP', 'ISK', 'HUF', 'PYG', 'UGX',
])

export function isZeroDecimalCurrency(currency: string): boolean {
  return ZERO_DECIMAL_CURRENCIES.has(currency)
}

/** Settlement threshold: amounts below this are considered zero */
export function settledThreshold(currency: string): number {
  return isZeroDecimalCurrency(currency) ? 1 : 0.01
}

/**
 * Largest remainder method: round balances to integers while preserving zero-sum.
 * Floor all values, then distribute +1 to entries with largest fractional remainders.
 */
function roundBalancesLargestRemainder(balances: Record<string, number>): Record<string, number> {
  const ids = Object.keys(balances)
  const floored: Record<string, number> = {}
  const remainders: { id: string; frac: number }[] = []

  for (const id of ids) {
    const f = Math.floor(balances[id])
    floored[id] = f
    remainders.push({ id, frac: balances[id] - f })
  }

  // How many +1s needed to keep sum = 0
  const diff = Math.round(-ids.reduce((s, id) => s + floored[id], 0))

  // Sort by fractional part descending, distribute +1
  remainders.sort((a, b) => b.frac - a.frac)
  for (let i = 0; i < diff; i++) {
    floored[remainders[i].id] += 1
  }

  return floored
}

/**
 * Calculate how much each person has paid and how much they owe.
 * Returns a balance map: positive = others owe them, negative = they owe others.
 * For zero-decimal currencies, applies largest remainder rounding to guarantee zero-sum integers.
 */
export function calculateBalances(
  expenses: TripExpense[],
  memberIds: string[],
  primaryCurrency?: string
): Record<string, number> {
  const balances: Record<string, number> = {}
  for (const id of memberIds) {
    balances[id] = 0
  }

  for (const expense of expenses) {
    const { payer, convertedAmount, splitMethod, participants, splitDetails } = expense

    // Payer paid this amount
    balances[payer] = (balances[payer] || 0) + convertedAmount

    // Calculate each participant's share
    const shares = calculateShares(convertedAmount, splitMethod, participants, splitDetails)

    // Each participant owes their share
    for (const [userId, share] of Object.entries(shares)) {
      balances[userId] = (balances[userId] || 0) - share
    }
  }

  // Round based on currency
  if (primaryCurrency && isZeroDecimalCurrency(primaryCurrency)) {
    return roundBalancesLargestRemainder(balances)
  }

  // Default: round to 2 decimal places
  for (const id of Object.keys(balances)) {
    balances[id] = Math.round(balances[id] * 100) / 100
  }

  return balances
}

/**
 * Calculate each participant's share of an expense.
 */
export function calculateShares(
  totalAmount: number,
  splitMethod: string,
  participants: string[],
  splitDetails: SplitDetail[]
): Record<string, number> {
  const shares: Record<string, number> = {}

  if (splitMethod === 'equal') {
    const share = totalAmount / participants.length
    for (const userId of participants) {
      shares[userId] = share
    }
  } else if (splitMethod === 'ratio') {
    const totalRatio = splitDetails.reduce((sum, d) => sum + d.value, 0)
    if (totalRatio > 0) {
      for (const detail of splitDetails) {
        if (participants.includes(detail.userId)) {
          shares[detail.userId] = (detail.value / totalRatio) * totalAmount
        }
      }
    }
  } else if (splitMethod === 'amount') {
    for (const detail of splitDetails) {
      if (participants.includes(detail.userId)) {
        shares[detail.userId] = detail.value
      }
    }
  }

  return shares
}

export interface CurrencyBreakdownEntry {
  amount: number        // net in original currency
  convertedAmount: number // net in primary currency
}

/**
 * Calculate per-person breakdown of net balance by original currency.
 * Returns both original and converted amounts so the UI can show equivalences.
 * Accepts pre-calculated balances to ensure the primary currency entry
 * is derived as (total - other currencies) so numbers always add up.
 */
export function calculateCurrencyBreakdown(
  expenses: TripExpense[],
  memberIds: string[],
  primaryCurrency: string,
  balances: Record<string, number>,
): Record<string, Record<string, CurrencyBreakdownEntry>> {
  const breakdown: Record<string, Record<string, CurrencyBreakdownEntry>> = {}
  for (const id of memberIds) {
    breakdown[id] = {}
  }

  const ensure = (userId: string, currency: string) => {
    if (!breakdown[userId][currency]) {
      breakdown[userId][currency] = { amount: 0, convertedAmount: 0 }
    }
  }

  for (const expense of expenses) {
    const { payer, amount, currency, convertedAmount, splitMethod, participants, splitDetails } = expense

    // Payer paid in original currency
    if (breakdown[payer]) {
      ensure(payer, currency)
      breakdown[payer][currency].amount += amount
      breakdown[payer][currency].convertedAmount += convertedAmount
    }

    // Calculate each participant's share
    const sharesConverted = calculateShares(convertedAmount, splitMethod, participants, splitDetails)

    for (const [userId, shareConverted] of Object.entries(sharesConverted)) {
      if (!breakdown[userId]) continue
      ensure(userId, currency)
      const shareOriginal = convertedAmount !== 0
        ? (shareConverted / convertedAmount) * amount
        : 0
      breakdown[userId][currency].amount -= shareOriginal
      breakdown[userId][currency].convertedAmount -= shareConverted
    }
  }

  // Round values and remove near-zero entries, then fix primary currency to match total
  for (const userId of memberIds) {
    const currencies = breakdown[userId]

    // Round non-primary currencies first
    let nonPrimaryConvertedSum = 0
    for (const cur of Object.keys(currencies)) {
      const entry = currencies[cur]
      const threshold = isZeroDecimalCurrency(cur) ? 1 : 0.01
      if (Math.abs(entry.amount) < threshold) {
        delete currencies[cur]
        continue
      }
      if (isZeroDecimalCurrency(cur)) {
        entry.amount = Math.round(entry.amount)
      } else {
        entry.amount = Math.round(entry.amount * 100) / 100
      }
      entry.convertedAmount = Math.round(entry.convertedAmount)
      if (cur !== primaryCurrency) {
        nonPrimaryConvertedSum += entry.convertedAmount
      }
    }

    // Fix primary currency: derive from total balance so it always adds up
    const total = balances[userId] || 0
    const primaryConverted = Math.round(total - nonPrimaryConvertedSum)
    if (currencies[primaryCurrency]) {
      currencies[primaryCurrency].convertedAmount = primaryConverted
      // For primary currency, amount === convertedAmount
      currencies[primaryCurrency].amount = primaryConverted
    }
    // Remove primary if near-zero after adjustment
    if (currencies[primaryCurrency]) {
      const threshold = isZeroDecimalCurrency(primaryCurrency) ? 1 : 0.01
      if (Math.abs(currencies[primaryCurrency].amount) < threshold) {
        delete currencies[primaryCurrency]
      }
    }
  }

  return breakdown
}

/**
 * Minimize the number of transfers needed to settle all debts.
 * Uses greedy algorithm: match the largest creditor with the largest debtor.
 */
export function minimizeTransfers(balances: Record<string, number>, threshold = 0.01): TransferSuggestion[] {
  // Separate into creditors (positive balance) and debtors (negative balance)
  const creditors: { userId: string; amount: number }[] = []
  const debtors: { userId: string; amount: number }[] = []

  for (const [userId, balance] of Object.entries(balances)) {
    if (balance > threshold) {
      creditors.push({ userId, amount: balance })
    } else if (balance < -threshold) {
      debtors.push({ userId, amount: -balance })
    }
  }

  // Sort descending by amount
  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort((a, b) => b.amount - a.amount)

  const transfers: TransferSuggestion[] = []

  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const transferAmount = Math.min(debtors[i].amount, creditors[j].amount)
    if (transferAmount > threshold) {
      transfers.push({
        from: debtors[i].userId,
        to: creditors[j].userId,
        amount: Math.round(transferAmount * 100) / 100,
      })
    }

    debtors[i].amount -= transferAmount
    creditors[j].amount -= transferAmount

    if (debtors[i].amount < threshold) i++
    if (creditors[j].amount < threshold) j++
  }

  return transfers
}
