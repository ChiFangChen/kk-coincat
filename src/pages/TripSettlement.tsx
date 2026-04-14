import { useState } from 'react'
import { useApp } from '../context/AppContext'
import type { Trip, User, SplitDetail } from '../types'
import { calculateBalances, calculateCurrencyBreakdown, minimizeTransfers, settledThreshold } from '../utils/settlement'
import { ExpenseForm } from '../components/ExpenseForm'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faPen, faArrowRight } from '@fortawesome/free-solid-svg-icons'

interface Props {
  trip: Trip
  members: User[]
}

export function TripSettlement({ trip, members }: Props) {
  const { getTripExpenses, getUserName, getUserColor, addExpense } = useApp()
  const [showCustomSettle, setShowCustomSettle] = useState(false)
  const [customSettleData, setCustomSettleData] = useState<{
    from: string
    to: string
    amount: number
  } | null>(null)
  const [confirmSettle, setConfirmSettle] = useState<{
    from: string
    to: string
    amount: number
  } | null>(null)

  const expenses = getTripExpenses(trip.id)
  const threshold = settledThreshold(trip.primaryCurrency)
  const balances = calculateBalances(expenses, trip.members, trip.primaryCurrency)
  const currencyBreakdown = calculateCurrencyBreakdown(expenses, trip.members, trip.primaryCurrency)
  const transfers = minimizeTransfers(balances, threshold)

  const handleSettle = (from: string, to: string, amount: number) => {
    if (trip.archived) return
    addExpense({
      tripId: trip.id,
      payer: from,
      amount,
      item: `結清：${getUserName(from)} → ${getUserName(to)}`,
      currency: trip.primaryCurrency,
      splitMethod: 'amount',
      participants: [to],
      splitDetails: [{ userId: to, value: amount }] as SplitDetail[],
      isSettlement: true,
      createdAt: new Date().toISOString(),
    })
  }

  const handleCustomSettle = (from: string, to: string, amount: number) => {
    setCustomSettleData({ from, to, amount })
    setShowCustomSettle(true)
  }

  const allSettled = Object.values(balances).every((b) => Math.abs(b) < threshold)

  return (
    <div className="page">
      <div className="page-header">
        <h1>結算</h1>
      </div>

      {/* Balance overview */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>餘額總覽</h2>
        <div className="balance-list">
          {members.map((m) => {
            const balance = balances[m.id] || 0
            return (
              <div key={m.id} className="balance-item">
                <div className="balance-name">{m.displayName}<span className="color-dot" style={{ backgroundColor: m.color }} /></div>
                <div className="balance-right">
                  <div className={`balance-amount ${balance > threshold ? 'positive' : balance < -threshold ? 'negative' : ''}`}>
                    {balance > threshold
                      ? `+${balance.toFixed(0)}`
                      : balance < -threshold
                        ? `${balance.toFixed(0)}`
                        : '0'}
                    <span className="balance-currency">{trip.primaryCurrency}</span>
                  </div>
                  {(() => {
                    const bd = currencyBreakdown[m.id] || {}
                    const currencies = Object.keys(bd)
                    const hasNonPrimary = currencies.some(c => c !== trip.primaryCurrency)
                    if (!hasNonPrimary || currencies.length === 0) return null
                    const parts = currencies
                      .sort((a, b) => a === trip.primaryCurrency ? -1 : b === trip.primaryCurrency ? 1 : a.localeCompare(b))
                      .map(cur => {
                        const entry = bd[cur]
                        const sign = entry.amount > 0 ? '+' : ''
                        return `${sign}${entry.amount.toLocaleString()}${cur}`
                      })
                    return (
                      <div className="balance-breakdown">
                        ({parts.join(' / ')})
                      </div>
                    )
                  })()}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Transfer suggestions */}
      <div className="card">
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>
          轉帳建議
          {allSettled && expenses.length > 0 && (
            <span className="trip-settled-badge" style={{ marginLeft: '0.5rem' }}>已全部結清</span>
          )}
        </h2>

        {expenses.length === 0 ? (
          <div className="empty-state" style={{ padding: '1.5rem 0' }}>
            <p>還沒有帳務</p>
          </div>
        ) : allSettled ? (
          <div className="empty-state" style={{ padding: '1.5rem 0' }}>
            <FontAwesomeIcon icon={faCheck} style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#16a34a' }} />
            <p>所有帳務已結清！</p>
          </div>
        ) : (
          <div className="transfer-list">
            {transfers.map((t, i) => (
              <div key={i} className="transfer-item">
                <div className="transfer-info">
                  <span className="transfer-name">{getUserName(t.from)}<span className="color-dot" style={{ backgroundColor: getUserColor(t.from) }} /></span>
                  <FontAwesomeIcon icon={faArrowRight} className="transfer-arrow" />
                  <span className="transfer-name">{getUserName(t.to)}<span className="color-dot" style={{ backgroundColor: getUserColor(t.to) }} /></span>
                  <span className="transfer-amount">
                    {t.amount.toLocaleString()} {trip.primaryCurrency}
                  </span>
                </div>
                {!trip.archived && (
                  <div className="transfer-actions">
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => setConfirmSettle({ from: t.from, to: t.to, amount: t.amount })}
                    >
                      <FontAwesomeIcon icon={faCheck} /><span>結清</span>
                    </button>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleCustomSettle(t.from, t.to, t.amount)}
                    >
                      <FontAwesomeIcon icon={faPen} /><span>自訂</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showCustomSettle && customSettleData && (
        <ExpenseForm
          trip={trip}
          members={members}
          defaultPayer={customSettleData.from}
          editingExpense={{
            id: '',
            tripId: trip.id,
            payer: customSettleData.from,
            amount: customSettleData.amount,
            item: `結清：${getUserName(customSettleData.from)} → ${getUserName(customSettleData.to)}`,
            currency: trip.primaryCurrency,
            exchangeRate: 1,
            convertedAmount: customSettleData.amount,
            splitMethod: 'amount',
            participants: [customSettleData.to],
            splitDetails: [{ userId: customSettleData.to, value: customSettleData.amount }],
            isSettlement: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }}
          onClose={() => {
            setShowCustomSettle(false)
            setCustomSettleData(null)
          }}
        />
      )}

      {confirmSettle && (
        <ConfirmDialog
          title="確認結清"
          message={`${getUserName(confirmSettle.from)} 付 ${confirmSettle.amount.toLocaleString()} ${trip.primaryCurrency} 給 ${getUserName(confirmSettle.to)}？`}
          confirmText="結清"
          onConfirm={() => {
            handleSettle(confirmSettle.from, confirmSettle.to, confirmSettle.amount)
            setConfirmSettle(null)
          }}
          onCancel={() => setConfirmSettle(null)}
        />
      )}
    </div>
  )
}
