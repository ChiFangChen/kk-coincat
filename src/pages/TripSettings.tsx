import { useState } from 'react'
import { useApp } from '../context/AppContext'
import type { Trip, User } from '../types'
import { fetchExchangeRates } from '../utils/currency'
import { formatDate } from '../utils/date'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSync, faArchive, faBoxOpen, faUserPlus, faTrash, faPlus, faCheck, faTimes, faStar as faStarSolid } from '@fortawesome/free-solid-svg-icons'

interface Props {
  trip: Trip
  members: User[]
  onBack: () => void
}

export function TripSettings({ trip, members, onBack }: Props) {
  const { state, updateTrip, deleteTrip, updateExchangeRates, isCurrentUserAdmin, isTripManager, fetchAndStoreTimezones } = useApp()
  const admin = isCurrentUserAdmin()
  const manager = isTripManager(trip)
  const canEdit = admin || manager
  const [name, setName] = useState(trip.name)
  const [showAddMember, setShowAddMember] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<string | null>(null)
  const [confirmRemoveCurrency, setConfirmRemoveCurrency] = useState<string | null>(null)
  const [confirmDeleteTrip, setConfirmDeleteTrip] = useState(false)
  const [fetchingRates, setFetchingRates] = useState(false)
  const [ratesError, setRatesError] = useState('')
  const [showAddCurrency, setShowAddCurrency] = useState(false)
  const [currencySearch, setCurrencySearch] = useState('')
  const [allRates, setAllRates] = useState<Record<string, number>>({})
  const [editingRate, setEditingRate] = useState<string | null>(null)
  const [editingRateValue, setEditingRateValue] = useState('')
  const timezoneList = state.timezones

  const TRACKED_KEY = `kk-coincat-tracked-currencies-${trip.id}`
  const [trackedList, setTrackedList] = useState<string[]>(() => {
    const saved = localStorage.getItem(TRACKED_KEY)
    return saved ? JSON.parse(saved) : []
  })

  const saveTrackedList = (list: string[]) => {
    setTrackedList(list)
    localStorage.setItem(TRACKED_KEY, JSON.stringify(list))
  }

  const currencies = ['TWD', ...trackedList.filter((c) => c !== 'TWD')]
  const nonMembers = state.users.filter((u) => !trip.members.includes(u.id) && !u.deleted)

  const handleSaveName = () => {
    if (name.trim() && name !== trip.name) {
      updateTrip({ ...trip, name: name.trim() })
    }
  }

  const handleAddMember = (userId: string) => {
    updateTrip({ ...trip, members: [...trip.members, userId] })
    setShowAddMember(false)
  }

  const handleRemoveMember = (userId: string) => {
    if (trip.members.length <= 1) return
    const updated = { ...trip, members: trip.members.filter((id) => id !== userId) }
    if (trip.managerId === userId) updated.managerId = undefined
    updateTrip(updated)
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
      // Update all rate values without changing the tracked list
      updateExchangeRates({ ...state.exchangeRates, ...rates })
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

  const trackedCurrencies = trackedList
    .map((code) => [code, state.exchangeRates[code] || 0] as [string, number])
    .sort(([a], [b]) => {
      const aIdx = currencies.indexOf(a)
      const bIdx = currencies.indexOf(b)
      if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx
      if (aIdx >= 0) return -1
      if (bIdx >= 0) return 1
      return a.localeCompare(b)
    })

  const handleRemoveCurrency = (code: string) => {
    saveTrackedList(trackedList.filter((c) => c !== code))
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
    if (!trackedList.includes(code)) {
      saveTrackedList([...trackedList, code])
    }
    // Also ensure rate exists
    if (!state.exchangeRates[code] && allRates[code]) {
      updateExchangeRates({ ...state.exchangeRates, [code]: allRates[code] })
    }
    setShowAddCurrency(false)
  }

  const COMMON_CURRENCIES = ['TWD', 'JPY', 'THB', 'USD', 'CNY', 'KRW', 'EUR', 'GBP']
  const availableToAdd = Object.keys(allRates).length > 0
    ? Object.keys(allRates).filter((code) => code !== trip.primaryCurrency && !trackedList.includes(code)).sort()
    : COMMON_CURRENCIES.filter((c) => c !== trip.primaryCurrency && !trackedList.includes(c))

  return (
    <div className="page">
      <div className="page-header">
        <h1>旅程設定</h1>
      </div>

      {/* Trip name */}
      <div className="settings-section">
        <h2>旅程名稱</h2>
        {canEdit && !trip.archived ? (
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

      {/* Timezone */}
      <div className="settings-section">
        <h2>時區</h2>
        {canEdit && !trip.archived ? (
          <div className="form-group">
            <select
              value={trip.timezone || 'Asia/Taipei'}
              onFocus={() => fetchAndStoreTimezones()}
              onChange={(e) => updateTrip({ ...trip, timezone: e.target.value })}
            >
              {timezoneList.length === 0 ? (
                <option value={trip.timezone || 'Asia/Taipei'}>{trip.timezone || 'Asia/Taipei'}</option>
              ) : (
                timezoneList.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))
              )}
            </select>
          </div>
        ) : (
          <div className="settings-value">{trip.timezone || 'Asia/Taipei'}</div>
        )}
      </div>

      {/* Exchange rates */}
      {canEdit && <div className="settings-section">
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
              同步於 {formatDate(lastSynced, trip.timezone)}
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
              {editingRate === code ? (
                <>
                  <input
                    type="number"
                    inputMode="decimal"
                    className="rate-edit-input"
                    value={editingRateValue}
                    onChange={(e) => setEditingRateValue(e.target.value)}
                    autoFocus
                  />
                  <button
                    className="btn-icon"
                    onClick={() => setEditingRate(null)}
                    title="取消"
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                  <button
                    className="btn-icon btn-save"
                    onClick={() => {
                      const val = parseFloat(editingRateValue)
                      if (!isNaN(val) && val > 0) {
                        updateExchangeRates({ ...state.exchangeRates, [code]: val })
                      }
                      setEditingRate(null)
                    }}
                    title="儲存"
                  >
                    <FontAwesomeIcon icon={faCheck} />
                  </button>
                </>
              ) : (
                <>
                  <span
                    className="rate-value rate-value-editable"
                    onClick={() => {
                      setEditingRate(code)
                      setEditingRateValue(String(rate))
                    }}
                  >
                    {rate}
                  </span>
                  <button
                    className="btn-icon btn-delete"
                    onClick={() => setConfirmRemoveCurrency(code)}
                    title="移除"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </>
              )}
            </div>
          ))}
          {trackedCurrencies.length === 0 && (
            <div className="empty-state" style={{ padding: '1rem 0' }}>尚未追蹤任何外幣</div>
          )}
        </div>
      </div>}

      {/* Members */}
      <div className="settings-section">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={{ margin: 0 }}>成員</h2>
          {canEdit && !trip.archived && nonMembers.length > 0 && (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => setShowAddMember(true)}
              style={{ marginLeft: 'auto' }}
              title="新增成員"
            >
              <FontAwesomeIcon icon={faUserPlus} />
            </button>
          )}
        </div>
        <div className="member-list-settings">
          {members.map((m) => (
            <div key={m.id} className="member-row">
              <div className="payer-badge" style={m.color ? { backgroundColor: m.color } : undefined}>{m.displayName.charAt(0).toUpperCase()}</div>
              <span className="member-row-name">{m.displayName}<span className="color-dot" style={{ backgroundColor: m.color }} /></span>
              {m.id === state.auth.currentUser?.id && <span className="you-tag">你</span>}
              {trip.managerId === m.id && <span className="manager-tag">負責人</span>}
              {admin && !trip.archived && (
                <button
                  className={`btn-icon${trip.managerId === m.id ? ' btn-manager-active' : ''}`}
                  onClick={() => updateTrip({ ...trip, managerId: trip.managerId === m.id ? undefined : m.id })}
                  title={trip.managerId === m.id ? '取消負責人' : '指定為負責人'}
                >
                  <FontAwesomeIcon icon={faStarSolid} />
                </button>
              )}
              {canEdit && !trip.archived && trip.members.length > 1 && (
                <button
                  className="btn-icon btn-delete"
                  onClick={() => setConfirmRemoveMember(m.id)}
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Archive */}
      {canEdit && <div className="settings-section">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>{trip.archived ? '已歸檔' : '歸檔旅程'}</h2>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
            <button
              className={`btn btn-sm ${trip.archived ? 'btn-primary' : 'btn-warning'}`}
              onClick={() => setConfirmArchive(true)}
              title={trip.archived ? '解除歸檔' : '歸檔'}
            >
              <FontAwesomeIcon icon={trip.archived ? faBoxOpen : faArchive} />
            </button>
            {trip.archived && (
              <button
                className="btn btn-sm btn-warning"
                onClick={() => setConfirmDeleteTrip(true)}
                title="刪除旅程"
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>
            )}
          </div>
        </div>
      </div>}

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

      {confirmRemoveMember && (() => {
        const member = members.find((m) => m.id === confirmRemoveMember)
        return (
          <ConfirmDialog
            title="移除成員"
            message={`確定要將「${member?.displayName}」從旅程中移除嗎？`}
            confirmText="移除"
            onConfirm={() => {
              handleRemoveMember(confirmRemoveMember)
              setConfirmRemoveMember(null)
            }}
            onCancel={() => setConfirmRemoveMember(null)}
          />
        )
      })()}

      {confirmRemoveCurrency && (
        <ConfirmDialog
          title="移除追蹤幣別"
          message={`確定要移除「${confirmRemoveCurrency}」嗎？`}
          confirmText="移除"
          onConfirm={() => {
            handleRemoveCurrency(confirmRemoveCurrency)
            setConfirmRemoveCurrency(null)
          }}
          onCancel={() => setConfirmRemoveCurrency(null)}
        />
      )}

      {confirmDeleteTrip && (
        <ConfirmDialog
          title="刪除旅程"
          message={`確定要刪除「${trip.name}」嗎？所有帳務紀錄將一併刪除，此操作無法復原。`}
          confirmText="刪除"
          onConfirm={() => {
            deleteTrip(trip.id)
            onBack()
          }}
          onCancel={() => setConfirmDeleteTrip(false)}
        />
      )}

      {showAddCurrency && (() => {
        const q = currencySearch.toUpperCase()
        const filtered = availableToAdd.filter((code) => code.includes(q))
        return (
          <div className="dialog-overlay" onClick={() => { setShowAddCurrency(false); setCurrencySearch('') }}>
            <div className="dialog" onClick={(e) => e.stopPropagation()}>
              <h3>新增追蹤幣別</h3>
              <div className="form-group">
                <input
                  type="text"
                  value={currencySearch}
                  onChange={(e) => setCurrencySearch(e.target.value)}
                  placeholder="搜尋幣別..."
                  autoFocus
                />
              </div>
              <div style={{ height: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {filtered.length === 0 ? (
                <p className="settings-hint">沒有符合的幣別</p>
              ) : (
                <>
                  {filtered.map((code) => (
                    <button
                      key={code}
                      className="btn btn-secondary"
                      onClick={() => { handleAddCurrency(code); setCurrencySearch('') }}
                      style={{ justifyContent: 'flex-start' }}
                    >
                      {code} {allRates[code] ? `(${allRates[code].toFixed(4)})` : ''}
                    </button>
                  ))}
                </>
              )}
              </div>
              <div className="dialog-actions">
                <button className="btn btn-secondary" onClick={() => { setShowAddCurrency(false); setCurrencySearch('') }}>
                  關閉
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
