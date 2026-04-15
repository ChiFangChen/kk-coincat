import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../context/AppContext'
import type { Trip, TripExpense, SplitMethod, SplitDetail, User } from '../types'
import { loadExpensePrefs, saveExpensePrefs } from '../utils/storage'
import { isoToLocalDatetime, localDatetimeToISO } from '../utils/date'
import { isZeroDecimalCurrency } from '../utils/settlement'

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
  const [currency, setCurrency] = useState(editingExpense?.currency || savedPrefs?.currency || trip.primaryCurrency)
  const [splitMethod, setSplitMethod] = useState<SplitMethod>(
    editingExpense?.splitMethod || (savedPrefs?.splitMethod as SplitMethod) || 'equal'
  )
  const [participants, setParticipants] = useState<string[]>(
    editingExpense?.participants || savedPrefs?.participants || trip.members
  )
  const [splitDetails, setSplitDetails] = useState<SplitDetail[]>(
    editingExpense?.splitDetails || members.map((m) => ({ userId: m.id, value: 0 }))
  )
  const tz = trip.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  const [datetime, setDatetime] = useState(() => {
    if (editingExpense) return isoToLocalDatetime(editingExpense.createdAt, tz)
    return isoToLocalDatetime(new Date().toISOString(), tz)
  })
  const [isSettlement] = useState(editingExpense?.isSettlement || false)

  // Available currencies: primary + tracked + editing expense's original currency
  const currencies = [
    'TWD',
    ...(trip.trackedCurrencies || []).filter((c) => c !== 'TWD'),
    ...(editingExpense?.currency && editingExpense.currency !== 'TWD' && !(trip.trackedCurrencies || []).includes(editingExpense.currency) ? [editingExpense.currency] : []),
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

  const [showSplitError, setShowSplitError] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const updateSplitValue = (userId: string, value: number) => {
    const isZeroDecimal = splitMethod === 'amount' && isZeroDecimalCurrency(currency)
    const shouldRound = splitMethod === 'ratio' || isZeroDecimal
    setSplitDetails((prev) =>
      prev.map((d) => (d.userId === userId ? { ...d, value: shouldRound ? Math.round(value) : value } : d))
    )
  }

  const handleBalanceValue = (userId: string) => {
    const activeSplits = splitDetails.filter((d) => participants.includes(d.userId))
    const othersSum = activeSplits
      .filter((d) => d.userId !== userId)
      .reduce((s, d) => s + d.value, 0)
    const numAmount = parseFloat(amount) || 0
    const target = splitMethod === 'ratio' ? 100 : (isZeroDecimalCurrency(currency) ? Math.round(numAmount) : numAmount)
    const remaining = target - othersSum
    updateSplitValue(userId, remaining > 0 ? remaining : 0)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitAttempted(true)
    setShowSplitError(true)
    if (!payer || !amount || participants.length === 0) return

    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) return

    // Validate split details
    const activeSplits = splitDetails.filter((d) => participants.includes(d.userId))
    let finalParticipants = participants
    if (splitMethod === 'ratio' || splitMethod === 'amount') {
      // Exclude participants with 0 value
      finalParticipants = activeSplits.filter((d) => d.value > 0).map((d) => d.userId)
      if (finalParticipants.length === 0) return
    }
    const finalSplits = splitDetails.filter((d) => finalParticipants.includes(d.userId))
    if (splitMethod === 'ratio') {
      const sum = finalSplits.reduce((s, d) => s + d.value, 0)
      if (Math.abs(sum - 100) > 0.01) return
    }
    if (splitMethod === 'amount') {
      const sum = finalSplits.reduce((s, d) => s + d.value, 0)
      if (Math.abs(sum - numAmount) > 0.01) return
    }

    // Save prefs for next time
    saveExpensePrefs(trip.id, { splitMethod, participants: finalParticipants, currency })

    const expenseData = {
      tripId: trip.id,
      payer,
      amount: numAmount,
      item: item.trim(),
      currency,
      splitMethod,
      participants: finalParticipants,
      splitDetails: finalSplits,
      isSettlement,
      createdAt: localDatetimeToISO(datetime, tz),
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

  return createPortal(
    <div className="dialog-overlay dialog-fullscreen-overlay" onClick={onClose}>
      <div className="dialog dialog-fullscreen" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>{editingExpense ? '編輯帳務' : '新增帳務'}</h3>
        </div>
        <form onSubmit={handleSubmit} className="expense-form">
          <div className="expense-form-body">
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
                  {m.displayName}<span className="color-dot" style={{ backgroundColor: m.color }} />
                </button>
              ))}
            </div>
            {submitAttempted && !payer && (
              <div className="split-error">請選擇付款人</div>
            )}
          </div>

          <div className="form-group">
            <label>項目</label>
            <input
              type="text"
              value={item}
              onChange={(e) => setItem(e.target.value)}

              autoFocus
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>金額</label>
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}

                step="any"
                min="0"
                required
              />
              {submitAttempted && (!amount || parseFloat(amount) <= 0) && (
                <div className="split-error">請輸入金額</div>
              )}
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
                  <span>{m.displayName}<span className="color-dot" style={{ backgroundColor: m.color }} /></span>
                </label>
              ))}
            </div>
            {submitAttempted && participants.length === 0 && (
              <div className="split-error">請選擇至少一位參與者</div>
            )}
          </div>

          {splitMethod !== 'equal' && (() => {
            const activeSplits = splitDetails.filter((d) => participants.includes(d.userId))
            const splitSum = activeSplits.reduce((s, d) => s + d.value, 0)
            const numAmount = Math.round(parseFloat(amount) || 0)
            const ratioInvalid = splitMethod === 'ratio' && splitSum !== 100
            const amountInvalid = splitMethod === 'amount' && splitSum !== numAmount
            const hasError = showSplitError && (ratioInvalid || amountInvalid)
            return (
              <div className="form-group">
                <label>{splitMethod === 'ratio' ? '比例' : '金額'}</label>
                <div className="split-details">
                  {activeSplits.map((detail) => {
                    const member = members.find((m) => m.id === detail.userId)
                    return (
                      <div key={detail.userId} className="split-detail-row">
                        <span className="split-detail-name">{member?.displayName}<span className="color-dot" style={{ backgroundColor: member?.color }} /></span>
                        <div className="split-detail-input-wrap">
                          <input
                            type="number"
                            inputMode="decimal"
                            value={detail.value || ''}
                            onChange={(e) =>
                              updateSplitValue(detail.userId, parseFloat(e.target.value) || 0)
                            }
                            onBlur={() => setShowSplitError(true)}
                            onFocus={() => setShowSplitError(false)}
                            step={splitMethod === 'amount' && !isZeroDecimalCurrency(currency) ? 'any' : '1'}
                            min="0"
                            className="split-detail-input"
                          />
                          {splitMethod === 'ratio' && <span className="split-detail-suffix">%</span>}
                        </div>
                        <button
                          type="button"
                          className={`btn btn-sm btn-secondary split-balance-btn${hasError ? '' : ' split-balance-hidden'}`}
                          onClick={() => handleBalanceValue(detail.userId)}
                        >
                          平衡
                        </button>
                      </div>
                    )
                  })}
                </div>
                {hasError && splitMethod === 'ratio' && (
                  <div className="split-error">合計 {splitSum}%，需為 100%</div>
                )}
                {hasError && splitMethod === 'amount' && (
                  <div className="split-error">合計 {splitSum}，需為 {numAmount}</div>
                )}
              </div>
            )
          })()}

          <div className="form-group">
            <label>日期時間</label>
            <input
              type="datetime-local"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
            />
          </div>

          </div>
          <div className="dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-primary">
              {editingExpense ? '更新' : '新增'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
