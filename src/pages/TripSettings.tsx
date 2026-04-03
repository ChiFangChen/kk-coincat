import { useState } from 'react'
import { useApp } from '../context/AppContext'
import type { Trip, User } from '../types'
import { fetchExchangeRates } from '../utils/currency'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSync, faArchive, faBoxOpen, faUserPlus, faTrash } from '@fortawesome/free-solid-svg-icons'

interface Props {
  trip: Trip
  members: User[]
  onBack: () => void
}

export function TripSettings({ trip, members, onBack }: Props) {
  const { state, updateTrip, updateExchangeRates, isCurrentUserAdmin } = useApp()
  const admin = isCurrentUserAdmin()
  const [name, setName] = useState(trip.name)
  const [currency, setCurrency] = useState(trip.primaryCurrency)
  const [showAddMember, setShowAddMember] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [fetchingRates, setFetchingRates] = useState(false)
  const [ratesError, setRatesError] = useState('')

  const currencies = ['TWD', 'JPY', 'THB', 'USD', 'CNY', 'KRW', 'EUR', 'GBP']
  const nonMembers = state.users.filter((u) => !trip.members.includes(u.id))

  const handleSaveName = () => {
    if (name.trim() && name !== trip.name) {
      updateTrip({ ...trip, name: name.trim() })
    }
  }

  const handleSaveCurrency = (newCurrency: string) => {
    setCurrency(newCurrency)
    if (newCurrency !== trip.primaryCurrency) {
      updateTrip({ ...trip, primaryCurrency: newCurrency })
    }
  }

  const handleAddMember = (userId: string) => {
    updateTrip({ ...trip, members: [...trip.members, userId] })
    setShowAddMember(false)
  }

  const handleRemoveMember = (userId: string) => {
    if (trip.members.length <= 1) return
    updateTrip({ ...trip, members: trip.members.filter((id) => id !== userId) })
  }

  const handleToggleArchive = () => {
    updateTrip({ ...trip, archived: !trip.archived })
    setConfirmArchive(false)
    if (!trip.archived) onBack()
  }

  const handleFetchRates = async () => {
    setFetchingRates(true)
    setRatesError('')
    try {
      const rates = await fetchExchangeRates(trip.primaryCurrency)
      const WHITELIST = ['TWD', 'JPY', 'THB', 'USD', 'CNY', 'KRW', 'EUR', 'GBP']
      const filtered: Record<string, number> = {}
      for (const code of WHITELIST) {
        if (code !== trip.primaryCurrency && rates[code]) {
          filtered[code] = rates[code]
        }
      }
      // Merge with existing rates
      updateExchangeRates({ ...state.exchangeRates, ...filtered })
    } catch {
      setRatesError('同步失敗，請稍後再試')
    } finally {
      setFetchingRates(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>旅程設定</h1>
      </div>

      {/* Trip name */}
      <div className="settings-section">
        <h2>旅程名稱</h2>
        {admin && !trip.archived ? (
          <div className="form-group">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleSaveName}
            />
          </div>
        ) : (
          <div className="settings-value">{trip.name}</div>
        )}
      </div>

      {/* Currency */}
      <div className="settings-section">
        <h2>主幣別</h2>
        <div className="form-group">
          <select
            value={currency}
            onChange={(e) => handleSaveCurrency(e.target.value)}
            disabled={!admin || trip.archived}
          >
            {currencies.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Exchange rates */}
      <div className="settings-section">
        <h2>匯率</h2>
        <p className="settings-hint">1 外幣 = ? {trip.primaryCurrency}</p>
        <button
          className="btn btn-sm btn-secondary"
          onClick={handleFetchRates}
          disabled={fetchingRates}
        >
          <FontAwesomeIcon icon={faSync} spin={fetchingRates} /> 同步匯率
        </button>
        {ratesError && <div className="auth-error" style={{ marginTop: '0.5rem' }}>{ratesError}</div>}
        <div className="rate-list">
          {Object.entries(state.exchangeRates)
            .filter(([code]) => code !== trip.primaryCurrency)
            .map(([code, rate]) => (
              <div key={code} className="rate-item">
                <span className="rate-code">{code}</span>
                <span className="rate-input" style={{ background: 'none' }}>{rate}</span>
              </div>
            ))}
        </div>
      </div>

      {/* Members */}
      <div className="settings-section">
        <h2>成員</h2>
        <div className="member-list-settings">
          {members.map((m) => (
            <div key={m.id} className="member-row">
              <div className="payer-badge" style={m.color ? { backgroundColor: m.color } : undefined}>{m.displayName.charAt(0).toUpperCase()}</div>
              <span className="member-row-name">{m.displayName}<span className="color-dot" style={{ backgroundColor: m.color }} /></span>
              {admin && !trip.archived && trip.members.length > 1 && (
                <button
                  className="btn-icon btn-delete"
                  onClick={() => handleRemoveMember(m.id)}
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              )}
            </div>
          ))}
        </div>
        {admin && !trip.archived && nonMembers.length > 0 && (
          <button
            className="btn btn-sm btn-secondary"
            style={{ marginTop: '0.75rem' }}
            onClick={() => setShowAddMember(true)}
          >
            <FontAwesomeIcon icon={faUserPlus} /> 新增成員
          </button>
        )}
      </div>

      {/* Archive */}
      <div className="settings-section">
        <h2>{trip.archived ? '解除歸檔' : '歸檔旅程'}</h2>
        <p className="settings-hint">
          {trip.archived ? '解除後可以繼續編輯帳務' : '歸檔後旅程將變為唯讀'}
        </p>
        <button
          className={`btn btn-sm ${trip.archived ? 'btn-primary' : 'btn-warning'}`}
          onClick={() => setConfirmArchive(true)}
        >
          <FontAwesomeIcon icon={trip.archived ? faBoxOpen : faArchive} />
          {trip.archived ? ' 解除歸檔' : ' 歸檔'}
        </button>
      </div>

      {/* Add member dialog */}
      {showAddMember && (
        <div className="dialog-overlay" onClick={() => setShowAddMember(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>新增成員</h3>
            <div className="member-select">
              {nonMembers.map((u) => (
                <button
                  key={u.id}
                  className="btn btn-secondary"
                  style={{ width: '100%', marginBottom: '0.5rem' }}
                  onClick={() => handleAddMember(u.id)}
                >
                  {u.displayName}<span className="color-dot" style={{ backgroundColor: u.color }} />
                </button>
              ))}
            </div>
            <button className="btn btn-secondary" onClick={() => setShowAddMember(false)}>取消</button>
          </div>
        </div>
      )}

      {confirmArchive && (
        <ConfirmDialog
          title={trip.archived ? '解除歸檔' : '歸檔旅程'}
          message={trip.archived ? '確定要解除歸檔嗎？' : '歸檔後旅程將變為唯讀，確��嗎？'}
          confirmText={trip.archived ? '解除' : '歸檔'}
          onConfirm={handleToggleArchive}
          onCancel={() => setConfirmArchive(false)}
        />
      )}
    </div>
  )
}
