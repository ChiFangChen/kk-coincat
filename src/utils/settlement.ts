import type { TripExpense, SplitDetail, TransferSuggestion } from '../types'

/**
 * Calculate how much each person has paid and how much they owe.
 * Returns a balance map: positive = others owe them, negative = they owe others.
 */
export function calculateBalances(
  expenses: TripExpense[],
  memberIds: string[]
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

  // Round to 2 decimal places
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

/**
 * Minimize the number of transfers needed to settle all debts.
 * Uses greedy algorithm: match the largest creditor with the largest debtor.
 */
export function minimizeTransfers(balances: Record<string, number>): TransferSuggestion[] {
  // Separate into creditors (positive balance) and debtors (negative balance)
  const creditors: { userId: string; amount: number }[] = []
  const debtors: { userId: string; amount: number }[] = []

  for (const [userId, balance] of Object.entries(balances)) {
    if (balance > 0.01) {
      creditors.push({ userId, amount: balance })
    } else if (balance < -0.01) {
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
    if (transferAmount > 0.01) {
      transfers.push({
        from: debtors[i].userId,
        to: creditors[j].userId,
        amount: Math.round(transferAmount * 100) / 100,
      })
    }

    debtors[i].amount -= transferAmount
    creditors[j].amount -= transferAmount

    if (debtors[i].amount < 0.01) i++
    if (creditors[j].amount < 0.01) j++
  }

  return transfers
}
