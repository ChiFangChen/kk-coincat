const API_URL = 'https://api.exchangerate-api.com/v4/latest/'

export interface ExchangeRateResponse {
  rates: Record<string, number>
}

export async function fetchExchangeRates(baseCurrency: string = 'TWD'): Promise<Record<string, number>> {
  try {
    const response = await fetch(`${API_URL}${baseCurrency}`)
    const data: ExchangeRateResponse = await response.json()

    // Invert rates: if 1 TWD = 0.031 USD, then 1 USD = 1/0.031 = 32.26 TWD
    const rates: Record<string, number> = {}
    for (const [currency, rate] of Object.entries(data.rates)) {
      if (currency !== baseCurrency && rate > 0) {
        rates[currency] = Math.round((1 / rate) * 10000) / 10000
      }
    }
    return rates
  } catch (error) {
    console.error('Failed to fetch exchange rates:', error)
    throw error
  }
}

export function convertToDefault(
  amount: number,
  currency: string,
  defaultCurrency: string,
  exchangeRates: Record<string, number>
): { convertedAmount: number; exchangeRate: number } {
  if (currency === defaultCurrency) {
    return { convertedAmount: amount, exchangeRate: 1 }
  }
  const rate = exchangeRates[currency] || 1
  return {
    convertedAmount: Math.round(amount * rate * 100) / 100,
    exchangeRate: rate,
  }
}
