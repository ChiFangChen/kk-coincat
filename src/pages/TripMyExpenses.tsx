import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import type { Trip, User } from '../types'
import { calculateShares } from '../utils/settlement'
import { formatDate } from '../utils/date'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHandshake } from '@fortawesome/free-solid-svg-icons'

interface Props {
  trip: Trip
  members: User[]
}

export function TripMyExpenses({ trip, members }: Props) {
  const { state, getTripExpenses, getUserName } = useApp()
  const currentUser = state.auth.currentUser
  const expenses = getTripExpenses(trip.id)

  const myItems = useMemo(() => {
    if (!currentUser) return []
    return expenses
      .filter((e) => e.payer === currentUser.id || e.participants.includes(currentUser.id))
      .map((e) => {
        const shares = calculateShares(e.convertedAmount, e.splitMethod, e.participants, e.splitDetails)
        const myShare = shares[currentUser.id] || 0
        // If I paid: I get back (total - myShare). If I didn't pay: I owe myShare.
        const delta = e.payer === currentUser.id
          ? e.convertedAmount - myShare
          : -myShare
        return { expense: e, myShare, delta }
      })
  }, [expenses, currentUser])

  const total = useMemo(() => {
    return Math.round(myItems.reduce((sum, item) => sum + item.delta, 0))
  }, [myItems])

  const fmt = (iso: string) => formatDate(iso, trip.timezone)

  if (!currentUser) return null

  return (
    <div className="page">
      {/* Total summary */}
      <div className="my-expenses-total">
        <span className="my-expenses-total-label">我的總額</span>
        <span className={`my-expenses-total-value ${total >= 0 ? 'positive' : 'negative'}`}>
          {total >= 0 ? '+' : ''}{total.toLocaleString()} {trip.primaryCurrency}
        </span>
      </div>

      {/* Expense list */}
      {myItems.length === 0 ? (
        <div className="empty-state">
          <p>沒有與你相關的帳務</p>
        </div>
      ) : (
        <div className="expense-list">
          {myItems.map(({ expense, delta }) => {
            const roundedDelta = Math.round(delta)
            return (
              <div
                key={expense.id}
                className={`expense-item ${expense.isSettlement ? 'settlement-item' : ''}`}
              >
                <div className="expense-left">
                  <div
                    className="payer-badge"
                    style={members.find((m) => m.id === expense.payer)?.color
                      ? { backgroundColor: members.find((m) => m.id === expense.payer)!.color }
                      : undefined}
                  >
                    {getUserName(expense.payer).charAt(0).toUpperCase()}
                  </div>
                  <div className="expense-info">
                    <div className="expense-item-name">
                      {expense.isSettlement && (
                        <FontAwesomeIcon icon={faHandshake} style={{ marginRight: '0.25rem', opacity: 0.6 }} />
                      )}
                      {expense.item}
                    </div>
                    <div className="expense-date">
                      {fmt(expense.createdAt)}
                      {' · '}
                      {expense.payer === currentUser.id ? '我付的' : getUserName(expense.payer) + '付的'}
                    </div>
                  </div>
                </div>
                <div className="expense-right">
                  <div>
                    <div className={`expense-amount ${roundedDelta >= 0 ? 'positive' : 'negative'}`}>
                      {roundedDelta >= 0 ? '+' : ''}{roundedDelta.toLocaleString()} {trip.primaryCurrency}
                    </div>
                    {expense.currency !== trip.primaryCurrency && (
                      <div className="expense-converted">
                        {expense.amount.toLocaleString()} {expense.currency}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
