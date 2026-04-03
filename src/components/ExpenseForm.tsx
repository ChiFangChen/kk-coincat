import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import type { Trip, TripExpense, SplitMethod, SplitDetail, User } from '../types'
import { loadExpensePrefs, saveExpensePrefs } from '../utils/storage'

interface Props {
  trip: Trip
  members: User[]
  defaultPayer?: string
  editingExpense?: TripExpense | null
  onClose: () => void
}

export function ExpenseForm({ trip, members, defaultPayer, editingExpense, onClose }: Props) {
  const { state, addExpense, updateExpense } = useApp()
  const currentUser = state.auth.currentUser

  // Load saved prefs for this trip
  const savedPrefs = loadExpensePrefs(trip.id)

  const [payer, setPayer] = useState(
    editingExpense?.payer || defaultPayer || currentUser?.id || ''
  )
  const [item, setItem] = useState(editingExpense?.item || '')
  const [amount, setAmount] = useState(editingExpense ? String(editingExpense.amount) : '')
  const [currency, setCurrency] = useState(editingExpense?.currency || trip.primaryCurrency)
  const [splitMethod, setSplitMethod] = useState<SplitMethod>(
    editingExpense?.splitMethod || (savedPrefs?.splitMethod as SplitMethod) || 'equal'
  )
  const [participants, setParticipants] = useState<string[]>(
    editingExpense?.participants || savedPrefs?.participants || trip.members
  )
  const [splitDetails, setSplitDetails] = useState<SplitDetail[]>(
    editingExpense?.splitDetails || members.map((m) => ({ userId: m.id, value: 1 }))
  )
  const [datetime, setDatetime] = useState(() => {
    if (editingExpense) return editingExpense.createdAt.slice(0, 16)
    return new Date().toISOString().slice(0, 16)
  })
  const [isSettlement] = useState(editingExpense?.isSettlement || false)

  // Available currencies from exchange rates + trip primary currency
  const currencies = [
    trip.primaryCurrency,
    ...Object.keys(state.exchangeRates).filter((c) => c !== trip.primaryCurrency),
  ]

  // Update splitDetails when participants change
  useEffect(() => {
    setSplitDetails((prev) => {
      const existing = new Map(prev.map((d) => [d.userId, d]))
      return participants.map((id) => existing.get(id) || { userId: id, value: 1 })
    })
  }, [participants])

  const toggleParticipant = (userId: string) => {
    setParticipants((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    )
  }

  const updateSplitValue = (userId: string, value: number) => {
    setSplitDetails((prev) =>
      prev.map((d) => (d.userId === userId ? { ...d, value } : d))
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!payer || !item.trim() || !amount || participants.length === 0) return

    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) return

    // Save prefs for next time
    saveExpensePrefs(trip.id, { splitMethod, participants })

    const expenseData = {
      tripId: trip.id,
      payer,
      amount: numAmount,
      item: item.trim(),
      currency,
      splitMethod,
      participants,
      splitDetails: splitDetails.filter((d) => participants.includes(d.userId)),
      isSettlement,
      createdAt: new Date(datetime).toISOString(),
    }

    if (editingExpense) {
      updateExpense({
        ...editingExpense,
        ...expenseData,
        convertedAmount: editingExpense.convertedAmount,
        exchangeRate: editingExpense.exchangeRate,
        updatedAt: new Date().toISOString(),
      })
    } else {
      addExpense(expenseData)
    }
    onClose()
  }

  const splitMethodLabel: Record<SplitMethod, string> = {
    equal: '均分',
    ratio: '自訂比例',
    amount: '自訂金額',
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{editingExpense ? '編輯帳務' : '新增帳務'}</h3>
        <form onSubmit={handleSubmit} className="expense-form">
          <div className="form-group">
            <label>付款人</label>
            <div className="payer-select">
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`btn btn-sm ${payer === m.id ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPayer(m.id)}
                >
                  {m.displayName}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>項目</label>
            <input
              type="text"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              placeholder="例如：午餐"
              required
              autoFocus
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>金額</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                step="any"
                min="0"
                required
              />
            </div>
            <div className="form-group">
              <label>幣別</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {currencies.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {currency !== trip.primaryCurrency && state.exchangeRates[currency] && (
            <div className="exchange-info">
              1 {currency} = {state.exchangeRates[currency]} {trip.primaryCurrency}
            </div>
          )}

          <div className="form-group">
            <label>分帳方式</label>
            <div className="payer-select">
              {(['equal', 'ratio', 'amount'] as SplitMethod[]).map((method) => (
                <button
                  key={method}
                  type="button"
                  className={`btn btn-sm ${splitMethod === method ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSplitMethod(method)}
                >
                  {splitMethodLabel[method]}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>參與者</label>
            <div className="member-select">
              {members.map((m) => (
                <label key={m.id} className="member-checkbox">
                  <input
                    type="checkbox"
                    checked={participants.includes(m.id)}
                    onChange={() => toggleParticipant(m.id)}
                  />
                  <span>{m.displayName}</span>
                </label>
              ))}
            </div>
          </div>

          {splitMethod !== 'equal' && (
            <div className="form-group">
              <label>{splitMethod === 'ratio' ? '比例' : '金額'}</label>
              <div className="split-details">
                {splitDetails
                  .filter((d) => participants.includes(d.userId))
                  .map((detail) => {
                    const member = members.find((m) => m.id === detail.userId)
                    return (
                      <div key={detail.userId} className="split-detail-row">
                        <span className="split-detail-name">{member?.displayName}</span>
                        <input
                          type="number"
                          value={detail.value}
                          onChange={(e) =>
                            updateSplitValue(detail.userId, parseFloat(e.target.value) || 0)
                          }
                          step="any"
                          min="0"
                          className="split-detail-input"
                        />
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          <div className="form-group">
            <label>日期時間</label>
            <input
              type="datetime-local"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
            />
          </div>

          <div className="dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-primary">
              {editingExpense ? '更新' : '新增'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
