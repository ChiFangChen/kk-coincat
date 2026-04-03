import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { calculateBalances } from '../utils/settlement'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faArchive, faBoxOpen } from '@fortawesome/free-solid-svg-icons'
import { CreateTrip } from '../components/CreateTrip'

type AdminFilter = 'all' | 'mine' | 'others'
const ADMIN_FILTER_KEY = 'kk-coincat-admin-trip-filter'

function getStoredAdminFilter(): AdminFilter {
  const stored = localStorage.getItem(ADMIN_FILTER_KEY)
  if (stored === 'all' || stored === 'mine' || stored === 'others') return stored
  return 'all'
}

interface Props {
  onSelectTrip: (tripId: string) => void
}

export function TripList({ onSelectTrip }: Props) {
  const { state, getUserName, getUserColor, getTripExpenses, isCurrentUserAdmin } = useApp()
  const [showCreate, setShowCreate] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const admin = isCurrentUserAdmin() || !!localStorage.getItem('kk-coincat-admin-session')
  const [adminFilter, setAdminFilter] = useState<AdminFilter>(getStoredAdminFilter)

  const currentUser = state.auth.currentUser
  if (!currentUser) return null

  const handleAdminFilterChange = (filter: AdminFilter) => {
    setAdminFilter(filter)
    localStorage.setItem(ADMIN_FILTER_KEY, filter)
  }

  const filteredTrips = admin
    ? adminFilter === 'mine'
      ? state.trips.filter((t) => t.members.includes(currentUser.id))
      : adminFilter === 'others'
        ? state.trips.filter((t) => !t.members.includes(currentUser.id))
        : state.trips
    : state.trips.filter((t) => t.members.includes(currentUser.id))
  const activeTrips = filteredTrips.filter((t) => !t.archived)
  const archivedTrips = filteredTrips.filter((t) => t.archived)
  const displayTrips = showArchived ? archivedTrips : activeTrips

  const getMyBalance = (tripId: string, memberIds: string[]) => {
    const expenses = getTripExpenses(tripId)
    if (expenses.length === 0) return 0
    const balances = calculateBalances(expenses, memberIds)
    return balances[currentUser.id] || 0
  }

  const isFullySettled = (tripId: string, memberIds: string[]) => {
    const expenses = getTripExpenses(tripId)
    if (expenses.length === 0) return false
    const balances = calculateBalances(expenses, memberIds)
    return Object.values(balances).every((b) => Math.abs(b) < 0.01)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>{admin ? '所有旅程' : '我的旅程'}</h1>
        {isCurrentUserAdmin() && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            <FontAwesomeIcon icon={faPlus} />
          </button>
        )}
      </div>

      {admin && (
        <div className="filter-bar">
          {([['all', '全部'], ['mine', '包含我'], ['others', '不含我']] as const).map(([key, label]) => (
            <button
              key={key}
              className={`btn btn-sm ${adminFilter === key ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleAdminFilterChange(key)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="filter-bar">
        <button
          className={`btn btn-sm ${!showArchived ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setShowArchived(false)}
        >
          進行中 ({activeTrips.length})
        </button>
        <button
          className={`btn btn-sm ${showArchived ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setShowArchived(true)}
        >
          <FontAwesomeIcon icon={faArchive} /> 已歸檔 ({archivedTrips.length})
        </button>
      </div>

      {displayTrips.length === 0 ? (
        <div className="empty-state">
          <FontAwesomeIcon icon={showArchived ? faArchive : faBoxOpen} style={{ fontSize: '2rem', marginBottom: '0.75rem' }} />
          <p>{showArchived ? '沒有已歸檔的旅程' : '還沒有旅程，建立一個吧！'}</p>
        </div>
      ) : (
        <div className="trip-list">
          {displayTrips.map((trip) => {
            const balance = getMyBalance(trip.id, trip.members)
            const settled = isFullySettled(trip.id, trip.members)
            const expenses = getTripExpenses(trip.id)
            return (
              <div
                key={trip.id}
                className="trip-card card"
                onClick={() => onSelectTrip(trip.id)}
              >
                <div className="trip-card-header">
                  <div className="trip-card-name">{trip.name}</div>
                  {settled && expenses.length > 0 && (
                    <span className="trip-settled-badge">已結清</span>
                  )}
                </div>
                <div className="trip-card-meta">
                  <span>{trip.members.length} 人</span>
                  <span>·</span>
                  <span>{expenses.length} 筆</span>
                </div>
                <div className="trip-card-members">
                  {trip.members.map((id) => (
                    <span key={id} className="trip-member-tag">
                      {getUserName(id)}
                      <span className="color-dot" style={{ backgroundColor: getUserColor(id) }} />
                    </span>
                  ))}
                </div>
                {expenses.length > 0 && !settled && (
                  <div className={`trip-card-balance ${balance >= 0 ? 'positive' : 'negative'}`}>
                    {balance >= 0 ? `別人欠你 ${balance.toFixed(0)}` : `你欠別人 ${Math.abs(balance).toFixed(0)}`}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showCreate && <CreateTrip onClose={() => setShowCreate(false)} />}
    </div>
  )
}
