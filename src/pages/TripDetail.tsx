import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { NavBar } from '../components/NavBar'
import { UserMenu } from '../components/UserMenu'
import { TripExpenses } from './TripExpenses'
import { TripMyExpenses } from './TripMyExpenses'
import { TripSettlement } from './TripSettlement'
import { TripSettings } from './TripSettings'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faArchive } from '@fortawesome/free-solid-svg-icons'

interface Props {
  tripId: string
  onBack: (notice?: string) => void
}

export function TripDetail({ tripId, onBack }: Props) {
  const { state, getTripMembers, isCurrentUserAdmin } = useApp()
  const [activeTab, setActiveTab] = useState<'expenses' | 'myExpenses' | 'settlement' | 'settings'>('expenses')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const trip = state.trips.find((t) => t.id === tripId)
  const adminSession = isCurrentUserAdmin() || !!localStorage.getItem('kk-coincat-admin-session')

  useEffect(() => {
    if (!trip || adminSession) return
    const userId = state.auth.currentUser?.id
    if (userId && !trip.members.includes(userId)) {
      onBack(`未加入「${trip.name}」！`)
    }
  }, [trip, state.auth.currentUser, adminSession])

  if (!trip) {
    return (
      <div className="page">
        <p>找不到旅程</p>
        <button className="btn btn-secondary" onClick={() => onBack()}>返回</button>
      </div>
    )
  }

  const members = getTripMembers(trip)

  return (
    <div className="app">
      <div className="trip-header">
        <button className="btn-icon" onClick={onBack}>
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <h1 className="trip-header-title">{trip.name}</h1>
        {trip.archived && (
          <span className="trip-archived-badge">
            <FontAwesomeIcon icon={faArchive} /> 已歸檔
          </span>
        )}
        {state.auth.currentUser && (
          <button
            className="identity-badge"
            onClick={() => setShowUserMenu(true)}
            style={state.auth.currentUser.color ? { backgroundColor: state.auth.currentUser.color, color: 'white' } : undefined}
          >
            {state.auth.currentUser.displayName}
          </button>
        )}
      </div>

      <div className="app-content">
        {activeTab === 'expenses' && <TripExpenses trip={trip} members={members} />}
        {activeTab === 'myExpenses' && <TripMyExpenses trip={trip} members={members} />}
        {activeTab === 'settlement' && <TripSettlement trip={trip} members={members} />}
        {activeTab === 'settings' && <TripSettings trip={trip} members={members} onBack={onBack} />}
      </div>

      <NavBar activeTab={activeTab} onTabChange={setActiveTab} />
      {showUserMenu && <UserMenu onClose={() => setShowUserMenu(false)} onSwitchUser={onBack} />}
    </div>
  )
}
