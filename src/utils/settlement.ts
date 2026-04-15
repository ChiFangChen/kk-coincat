import type { TripExpense, SplitDetail, TransferSuggestion } from "../types";

/** Currencies with no decimal subunit */
const ZERO_DECIMAL_CURRENCIES = new Set([
  "TWD",
  "JPY",
  "KRW",
  "VND",
  "IDR",
  "CLP",
  "ISK",
  "HUF",
  "PYG",
  "UGX",
]);

export function isZeroDecimalCurrency(currency: string): boolean {
  return ZERO_DECIMAL_CURRENCIES.has(currency);
}

/** Settlement threshold: amounts below this are considered zero */
export function settledThreshold(currency: string): number {
  return isZeroDecimalCurrency(currency) ? 1 : 0.01;
}

/**
 * Largest remainder method: round balances to integers while preserving zero-sum.
 * Floor all values, then distribute +1 to entries with largest fractional remainders.
 */
function roundBalancesLargestRemainder(
  balances: Record<string, number>,
): Record<string, number> {
  const ids = Object.keys(balances);
  const floored: Record<string, number> = {};
  const remainders: { id: string; frac: number }[] = [];

  for (const id of ids) {
    const f = Math.floor(balances[id]);
    floored[id] = f;
    remainders.push({ id, frac: balances[id] - f });
  }

  // How many +1s needed to keep sum = 0
  const diff = Math.round(-ids.reduce((s, id) => s + floored[id], 0));

  // Sort by fractional part descending, distribute +1
  remainders.sort((a, b) => b.frac - a.frac);
  const adjustCount = Math.max(0, Math.min(diff, remainders.length));
  for (let i = 0; i < adjustCount; i++) {
    floored[remainders[i].id] += 1;
  }

  // Force zero-sum: adjust entry with largest absolute value (least relative impact)
  const sum = ids.reduce((s, id) => s + floored[id], 0);
  if (sum !== 0) {
    const maxId = ids.reduce((a, b) =>
      Math.abs(floored[a]) >= Math.abs(floored[b]) ? a : b,
    );
    floored[maxId] -= sum;
  }

  return floored;
}

function roundBalancesAtScale(
  balances: Record<string, number>,
  scale: number,
): Record<string, number> {
  const ids = Object.keys(balances);
  const flooredScaled: Record<string, number> = {};
  const remainders: { id: string; frac: number }[] = [];

  for (const id of ids) {
    const scaled = balances[id] * scale;
    const floored = Math.floor(scaled);
    flooredScaled[id] = floored;
    remainders.push({ id, frac: scaled - floored });
  }

  const diff = Math.round(-ids.reduce((sum, id) => sum + flooredScaled[id], 0));
  remainders.sort((a, b) => b.frac - a.frac);

  const adjustCount = Math.max(0, Math.min(diff, remainders.length));
  for (let i = 0; i < adjustCount; i++) {
    flooredScaled[remainders[i].id] += 1;
  }

  const sum = ids.reduce((acc, id) => acc + flooredScaled[id], 0);
  if (sum !== 0) {
    const maxId = ids.reduce((a, b) =>
      Math.abs(flooredScaled[a]) >= Math.abs(flooredScaled[b]) ? a : b,
    );
    flooredScaled[maxId] -= sum;
  }

  const rounded: Record<string, number> = {};
  for (const id of ids) {
    rounded[id] = flooredScaled[id] / scale;
  }
  return rounded;
}

/**
 * Calculate how much each person has paid and how much they owe.
 * Returns a balance map: positive = others owe them, negative = they owe others.
 * For zero-decimal currencies, applies largest remainder rounding to guarantee zero-sum integers.
 */
export function calculateBalances(
  expenses: TripExpense[],
  memberIds: string[],
  primaryCurrency?: string,
): Record<string, number> {
  const balances: Record<string, number> = {};
  for (const id of memberIds) {
    balances[id] = 0;
  }

  for (const expense of expenses) {
    const { payer, convertedAmount, splitMethod, participants, splitDetails } =
      expense;

    // Payer paid this amount
    balances[payer] = (balances[payer] || 0) + convertedAmount;

    // Calculate each participant's share
    const shares = calculateShares(
      convertedAmount,
      splitMethod,
      participants,
      splitDetails,
      expense.amount,
    );

    // Each participant owes their share
    for (const [userId, share] of Object.entries(shares)) {
      balances[userId] = (balances[userId] || 0) - share;
    }
  }

  // Round based on currency
  if (primaryCurrency && isZeroDecimalCurrency(primaryCurrency)) {
    return roundBalancesLargestRemainder(balances);
  }

  // Default: round to 2 decimal places
  for (const id of Object.keys(balances)) {
    balances[id] = Math.round(balances[id] * 100) / 100;
  }

  return balances;
}

/**
 * Calculate each participant's share of an expense.
 */
export function calculateShares(
  totalAmount: number,
  splitMethod: string,
  participants: string[],
  splitDetails: SplitDetail[],
  originalAmount?: number,
): Record<string, number> {
  const shares: Record<string, number> = {};

  if (splitMethod === "equal") {
    const share = totalAmount / participants.length;
    for (const userId of participants) {
      shares[userId] = share;
    }
  } else if (splitMethod === "ratio") {
    const totalRatio = splitDetails.reduce((sum, d) => sum + d.value, 0);
    if (totalRatio > 0) {
      for (const detail of splitDetails) {
        if (participants.includes(detail.userId)) {
          shares[detail.userId] = (detail.value / totalRatio) * totalAmount;
        }
      }
    }
  } else if (splitMethod === "amount") {
    const baseAmount = originalAmount ?? totalAmount;
    for (const detail of splitDetails) {
      if (participants.includes(detail.userId)) {
        shares[detail.userId] =
          baseAmount !== 0 ? (detail.value / baseAmount) * totalAmount : 0;
      }
    }
  }

  return shares;
}

export function calculateOriginalShares(
  totalAmount: number,
  splitMethod: string,
  participants: string[],
  splitDetails: SplitDetail[],
): Record<string, number> {
  const shares: Record<string, number> = {};

  if (splitMethod === "equal") {
    const share = totalAmount / participants.length;
    for (const userId of participants) {
      shares[userId] = share;
    }
  } else if (splitMethod === "ratio") {
    const totalRatio = splitDetails.reduce((sum, d) => sum + d.value, 0);
    if (totalRatio > 0) {
      for (const detail of splitDetails) {
        if (participants.includes(detail.userId)) {
          shares[detail.userId] = (detail.value / totalRatio) * totalAmount;
        }
      }
    }
  } else if (splitMethod === "amount") {
    for (const detail of splitDetails) {
      if (participants.includes(detail.userId)) {
        shares[detail.userId] = detail.value;
      }
    }
  }

  return shares;
}

export interface CurrencyBreakdownEntry {
  amount: number; // net in original currency
  convertedAmount: number; // net in primary currency
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
): Record<string, Record<string, CurrencyBreakdownEntry>> {
  const breakdown: Record<string, Record<string, CurrencyBreakdownEntry>> = {};
  for (const id of memberIds) {
    breakdown[id] = {};
  }

  const ensure = (userId: string, currency: string) => {
    if (!breakdown[userId][currency]) {
      breakdown[userId][currency] = { amount: 0, convertedAmount: 0 };
    }
  };

  for (const expense of expenses) {
    const {
      payer,
      amount,
      currency,
      convertedAmount,
      splitMethod,
      participants,
      splitDetails,
    } = expense;

    // Payer paid in original currency
    if (breakdown[payer]) {
      ensure(payer, currency);
      breakdown[payer][currency].amount += amount;
      breakdown[payer][currency].convertedAmount += convertedAmount;
    }

    // Calculate each participant's share
    const sharesConverted = calculateShares(
      convertedAmount,
      splitMethod,
      participants,
      splitDetails,
      amount,
    );
    const sharesOriginal = calculateOriginalShares(
      amount,
      splitMethod,
      participants,
      splitDetails,
    );

    for (const [userId, shareConverted] of Object.entries(sharesConverted)) {
      if (!breakdown[userId]) continue;
      ensure(userId, currency);
      const shareOriginal = sharesOriginal[userId] || 0;
      breakdown[userId][currency].amount -= shareOriginal;
      breakdown[userId][currency].convertedAmount -= shareConverted;
    }
  }

  const allCurrencies = new Set<string>();
  for (const userId of memberIds) {
    for (const currency of Object.keys(breakdown[userId])) {
      allCurrencies.add(currency);
    }
  }

  // Round each currency across all members together so the displayed breakdown stays zero-sum.
  for (const currency of allCurrencies) {
    const rawAmounts: Record<string, number> = {};
    const rawConvertedAmounts: Record<string, number> = {};
    const originalThreshold = isZeroDecimalCurrency(currency) ? 1 : 0.01;
    const convertedThreshold = isZeroDecimalCurrency(primaryCurrency)
      ? 1
      : 0.01;

    for (const userId of memberIds) {
      const entry = breakdown[userId][currency];
      rawAmounts[userId] = entry?.amount || 0;
      rawConvertedAmounts[userId] = entry?.convertedAmount || 0;
    }

    const hasMeaningfulOriginal = memberIds.some(
      (userId) => Math.abs(rawAmounts[userId]) >= originalThreshold,
    );
    if (!hasMeaningfulOriginal) {
      for (const userId of memberIds) {
        delete breakdown[userId][currency];
      }
      continue;
    }

    const roundedOriginal = isZeroDecimalCurrency(currency)
      ? roundBalancesLargestRemainder(rawAmounts)
      : roundBalancesAtScale(rawAmounts, 100);
    const roundedConverted = isZeroDecimalCurrency(primaryCurrency)
      ? roundBalancesLargestRemainder(rawConvertedAmounts)
      : roundBalancesAtScale(rawConvertedAmounts, 100);

    for (const userId of memberIds) {
      const roundedAmount = roundedOriginal[userId];
      const roundedConvertedAmount = roundedConverted[userId];
      if (
        Math.abs(roundedAmount) < originalThreshold &&
        Math.abs(roundedConvertedAmount) < convertedThreshold
      ) {
        delete breakdown[userId][currency];
        continue;
      }

      breakdown[userId][currency] = {
        amount: roundedAmount,
        convertedAmount: roundedConvertedAmount,
      };
    }
  }

  return breakdown;
}

/**
 * Minimize the number of transfers needed to settle all debts.
 * Uses greedy algorithm: match the largest creditor with the largest debtor.
 */
export function minimizeTransfers(
  balances: Record<string, number>,
  threshold = 0.01,
): TransferSuggestion[] {
  // Separate into creditors (positive balance) and debtors (negative balance)
  const creditors: { userId: string; amount: number }[] = [];
  const debtors: { userId: string; amount: number }[] = [];

  for (const [userId, balance] of Object.entries(balances)) {
    if (balance > threshold) {
      creditors.push({ userId, amount: balance });
    } else if (balance < -threshold) {
      debtors.push({ userId, amount: -balance });
    }
  }

  // Sort descending by amount
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transfers: TransferSuggestion[] = [];

  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const transferAmount = Math.min(debtors[i].amount, creditors[j].amount);
    if (transferAmount > threshold) {
      transfers.push({
        from: debtors[i].userId,
        to: creditors[j].userId,
        amount: Math.round(transferAmount * 100) / 100,
      });
    }

    debtors[i].amount -= transferAmount;
    creditors[j].amount -= transferAmount;

    if (debtors[i].amount < threshold) i++;
    if (creditors[j].amount < threshold) j++;
  }

  return transfers;
}
