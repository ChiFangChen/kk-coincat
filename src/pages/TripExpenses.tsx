import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import type { Trip, TripExpense, User } from '../types'
import { ExpenseForm } from '../components/ExpenseForm'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash, faPen, faHandshake } from '@fortawesome/free-solid-svg-icons'
import { formatDate } from '../utils/date'

interface Props {
  trip: Trip
  members: User[]
}

const LAST_PAYER_KEY = 'kk-coincat-last-payer-'

export function TripExpenses({ trip, members }: Props) {
  const { getTripExpenses, deleteExpense, getUserName } = useApp()
  const [showForm, setShowForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState<TripExpense | null>(null)
  const [defaultPayer, setDefaultPayer] = useState<string | undefined>()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPayer, setFilterPayer] = useState<string | null>(null)

  const expenses = getTripExpenses(trip.id)

  // Get last selected payer for ordering quick-add buttons
  const lastPayerId = localStorage.getItem(LAST_PAYER_KEY + trip.id)
  const orderedMembers = useMemo(() => {
    if (!lastPayerId) return members
    const last = members.find((m) => m.id === lastPayerId)
    if (!last) return members
    return [last, ...members.filter((m) => m.id !== lastPayerId)]
  }, [members, lastPayerId])

  const filteredExpenses = useMemo(() => {
    let result = expenses
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter((e) => e.item.toLowerCase().includes(q))
    }
    if (filterPayer) {
      result = result.filter((e) => e.payer === filterPayer)
    }
    return result
  }, [expenses, searchQuery, filterPayer])

  const handleQuickAdd = (payerId: string) => {
    if (trip.archived) return
    localStorage.setItem(LAST_PAYER_KEY + trip.id, payerId)
    setDefaultPayer(payerId)
    setEditingExpense(null)
    setShowForm(true)
  }

  const handleEdit = (expense: TripExpense) => {
    if (trip.archived) return
    setEditingExpense(expense)
    setDefaultPayer(undefined)
    setShowForm(true)
  }

  const handleDelete = () => {
    if (deleteId) {
      deleteExpense(deleteId)
      setDeleteId(null)
    }
  }

  const fmt = (iso: string) => formatDate(iso, trip.timezone)

  const splitMethodLabel: Record<string, string> = {
    equal: '均分',
    ratio: '比例',
    amount: '自訂',
  }

  return (
    <div className="page">
      {/* Quick add member buttons */}
      {!trip.archived && (
        <div className="quick-add-scroll">
          {orderedMembers.map((m) => (
            <button
              key={m.id}
              className="quick-add-member-btn"
              onClick={() => handleQuickAdd(m.id)}
            >
              <span className="quick-add-member-avatar" style={m.color ? { backgroundColor: m.color } : undefined}>
                {m.displayName.charAt(0).toUpperCase()}
              </span>
              <span className="quick-add-member-name">{m.displayName}</span>
            </button>
          ))}
        </div>
      )}

      {/* Search & filter */}
      <div className="search-bar">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜尋項目..."
        />
      </div>

      <div className="filter-bar">
        <button
          className={`btn btn-sm ${!filterPayer ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilterPayer(null)}
        >
          全部
        </button>
        {members.map((m) => (
          <button
            key={m.id}
            className={`btn btn-sm ${filterPayer === m.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterPayer(filterPayer === m.id ? null : m.id)}
          >
            {m.displayName}
            <span className="color-dot" style={{ backgroundColor: m.color }} />
          </button>
        ))}
      </div>

      {/* Expense list */}
      {filteredExpenses.length === 0 ? (
        <div className="empty-state">
          <p>{expenses.length === 0 ? '還沒有帳務，點上方的名字開始記帳！' : '找不到符合的帳務'}</p>
        </div>
      ) : (
        <div className="expense-list">
          {filteredExpenses.map((expense) => (
            <div
              key={expense.id}
              className={`expense-item ${expense.isSettlement ? 'settlement-item' : ''}`}
              onClick={() => handleEdit(expense)}
            >
              <div className="expense-left">
                <div className="payer-badge" style={members.find((m) => m.id === expense.payer)?.color ? { backgroundColor: members.find((m) => m.id === expense.payer)!.color } : undefined}>
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
                  </div>
                </div>
              </div>
              <div className="expense-right">
                <div>
                  <div className="expense-amount">
                    {expense.amount.toLocaleString()} {expense.currency}
                  </div>
                  {expense.currency !== trip.primaryCurrency && (
                    <div className="expense-converted">
                      ≈ {expense.convertedAmount.toLocaleString()} {trip.primaryCurrency}
                    </div>
                  )}
                  <div className="expense-date" style={{ textAlign: 'right', fontSize: '0.7rem' }}>
                    {splitMethodLabel[expense.splitMethod] || expense.splitMethod}
                    {expense.participants.length < members.length && ` · ${expense.participants.length} 人`}
                  </div>
                </div>
                {!trip.archived && (
                  <button
                    className="btn-icon btn-delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteId(expense.id)
                    }}
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {trip.archived && (
        <div className="archived-notice">
          <FontAwesomeIcon icon={faPen} style={{ marginRight: '0.375rem' }} />
          已歸檔，無法編輯
        </div>
      )}

      {showForm && (
        <ExpenseForm
          trip={trip}
          members={members}
          defaultPayer={defaultPayer}
          editingExpense={editingExpense}
          onClose={() => {
            setShowForm(false)
            setEditingExpense(null)
          }}
        />
      )}

      {deleteId && (
        <ConfirmDialog
          title="刪除帳務"
          message="確定要刪除這筆帳務嗎？"
          confirmText="刪除"
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
          danger
        />
      )}
    </div>
  )
}
