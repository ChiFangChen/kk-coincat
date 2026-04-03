import { useState } from 'react'
import { useApp } from '../context/AppContext'
import type { Trip, User } from '../types'
import { fetchExchangeRates } from '../utils/currency'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSync, faArchive, faBoxOpen, faUserPlus, faTrash, faPlus } from '@fortawesome/free-solid-svg-icons'

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
  const [showAddCurrency, setShowAddCurrency] = useState(false)
  const [allRates, setAllRates] = useState<Record<string, number>>({})

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

  const RATES_SYNC_KEY = 'kk-coincat-rates-synced'
  const [lastSynced, setLastSynced] = useState<string | null>(
    localStorage.getItem(RATES_SYNC_KEY)
  )

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
      updateExchangeRates({ ...state.exchangeRates, ...filtered })
      const now = new Date().toISOString()
      localStorage.setItem(RATES_SYNC_KEY, now)
      setLastSynced(now)
      setAllRates(rates)
    } catch {
      setRatesError('同步失敗，請稍後再試')
    } finally {
      setFetchingRates(false)
    }
  }

  const trackedCurrencies = Object.entries(state.exchangeRates)
    .filter(([code]) => code !== trip.primaryCurrency)
    .sort(([a], [b]) => {
      const aIdx = currencies.indexOf(a)
      const bIdx = currencies.indexOf(b)
      if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx
      if (aIdx >= 0) return -1
      if (bIdx >= 0) return 1
      return a.localeCompare(b)
    })

  const handleRemoveCurrency = (code: string) => {
    const newRates = { ...state.exchangeRates }
    delete newRates[code]
    updateExchangeRates(newRates)
  }

  const handleOpenAddCurrency = async () => {
    if (Object.keys(allRates).length === 0) {
      try {
        const rates = await fetchExchangeRates(trip.primaryCurrency)
        setAllRates(rates)
      } catch {
        // Fallback: show common currencies
      }
    }
    setShowAddCurrency(true)
  }

  const handleAddCurrency = (code: string) => {
    const rate = allRates[code] || state.exchangeRates[code] || 1
    updateExchangeRates({ ...state.exchangeRates, [code]: rate })
    setShowAddCurrency(false)
  }

  const availableToAdd = Object.keys(allRates).length > 0
    ? Object.keys(allRates).filter((code) => code !== trip.primaryCurrency && !state.exchangeRates[code]).sort()
    : currencies.filter((c) => c !== trip.primaryCurrency && !state.exchangeRates[c])

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
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={{ margin: 0 }}>匯率</h2>
          <button
            className="btn btn-sm btn-secondary"
            onClick={handleFetchRates}
            disabled={fetchingRates}
            title="同步匯率"
            style={{ marginLeft: '0.5rem' }}
          >
            <FontAwesomeIcon icon={faSync} spin={fetchingRates} />
          </button>
          {lastSynced && (
            <span className="settings-hint" style={{ margin: 0, marginLeft: 'auto', opacity: 0.7 }}>
              同步於 {new Date(lastSynced).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <p className="settings-hint" style={{ margin: 0 }}>1 外幣 = ? {trip.primaryCurrency}</p>
          <button
            className="btn btn-sm btn-primary"
            onClick={handleOpenAddCurrency}
            style={{ marginLeft: 'auto' }}
            title="新增幣別"
          >
            <FontAwesomeIcon icon={faPlus} />
          </button>
        </div>
        {ratesError && <div className="auth-error" style={{ marginTop: '0.5rem' }}>{ratesError}</div>}
        <div className="rate-list">
          {trackedCurrencies.map(([code, rate]) => (
            <div key={code} className="rate-item">
              <span className="rate-code">{code}</span>
              <span className="rate-input" style={{ background: 'none' }}>{rate}</span>
              <button
                className="btn-icon btn-delete"
                onClick={() => handleRemoveCurrency(code)}
                title="移除"
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>
            </div>
          ))}
          {trackedCurrencies.length === 0 && (
            <div className="empty-state" style={{ padding: '1rem 0' }}>尚未追蹤任何外幣</div>
          )}
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
          message={trip.archived ? '確定要解除歸檔嗎？' : '歸檔後旅程將變為唯讀，確定嗎？'}
          confirmText={trip.archived ? '解除' : '歸檔'}
          onConfirm={handleToggleArchive}
          onCancel={() => setConfirmArchive(false)}
        />
      )}

      {showAddCurrency && (
        <div className="dialog-overlay" onClick={() => setShowAddCurrency(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>新增追蹤幣別</h3>
            {availableToAdd.length === 0 ? (
              <p className="settings-hint">沒有可新增的幣別</p>
            ) : (
              <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {availableToAdd.map((code) => (
                  <button
                    key={code}
                    className="btn btn-secondary"
                    onClick={() => handleAddCurrency(code)}
                    style={{ justifyContent: 'flex-start' }}
                  >
                    {code} {allRates[code] ? `(${allRates[code].toFixed(4)})` : ''}
                  </button>
                ))}
              </div>
            )}
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setShowAddCurrency(false)}>
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
