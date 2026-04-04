import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppProvider, useApp } from './context/AppContext'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { TripList } from './pages/TripList'
import { TripDetail } from './pages/TripDetail'
import { UserMenu } from './components/UserMenu'
import { ConfirmDialog } from './components/ConfirmDialog'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSun, faMoon } from '@fortawesome/free-solid-svg-icons'
import './App.css'

function AppContent() {
  const { state, updateSettings, updateTrip } = useApp()

  // Sync theme class to <html> so background-color stays correct during transitions
  useEffect(() => {
    document.documentElement.className = `theme-${state.settings.theme}`
  }, [state.settings.theme])

  const [authPage, setAuthPage] = useState<'login' | 'register'>('login')
  const [selectedTripId, setSelectedTripId] = useState<string | null>(() => {
    return localStorage.getItem('kk-coincat-route-trip') || null
  })
  const [showSwitchUser, setShowSwitchUser] = useState(false)

  // Join trip via URL: ?join=<tripId>
  const [joinTripId, setJoinTripId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('join')
  })
  const [joinNotice, setJoinNotice] = useState<string | null>(null)

  // Clear ?join from URL without reload
  useEffect(() => {
    if (joinTripId) {
      const url = new URL(window.location.href)
      url.searchParams.delete('join')
      window.history.replaceState({}, '', url.pathname)
    }
  }, [joinTripId])

  const joinTrip = state.trips.find(t => t.id === joinTripId)

  const handleJoinConfirm = () => {
    if (!joinTrip || !state.auth.currentUser) return
    if (joinTrip.members.includes(state.auth.currentUser.id)) {
      setJoinNotice('已在旅程中！')
      setJoinTripId(null)
      return
    }
    updateTrip({ ...joinTrip, members: [...joinTrip.members, state.auth.currentUser.id] })
    setJoinTripId(null)
    setSelectedTripId(joinTrip.id)
    localStorage.setItem('kk-coincat-route-trip', joinTrip.id)
  }

  const handleJoinCancel = () => {
    setJoinTripId(null)
  }

  // Join dialog (portal so it renders above everything)
  const joinDialog = joinTripId && joinTrip && state.auth.currentUser ? createPortal(
    joinTrip.members.includes(state.auth.currentUser.id) ? (
      <ConfirmDialog
        title="加入旅程"
        message="已在旅程中！"
        confirmText="確定"
        onConfirm={() => setJoinTripId(null)}
        onCancel={() => setJoinTripId(null)}
      />
    ) : (
      <ConfirmDialog
        title="加入旅程"
        message={`是否加入「${joinTrip.name}」旅程？`}
        confirmText="加入"
        onConfirm={handleJoinConfirm}
        onCancel={handleJoinCancel}
      />
    ),
    document.body
  ) : null

  const noticeDialog = joinNotice ? createPortal(
    <ConfirmDialog
      title="提示"
      message={joinNotice}
      confirmText="確定"
      onConfirm={() => setJoinNotice(null)}
      onCancel={() => setJoinNotice(null)}
    />,
    document.body
  ) : null

  // Not logged in — only show register if no users exist yet
  if (!state.auth.currentUser) {
    if (authPage === 'register') {
      return <>{joinTripId && <></>}<Register onSwitchToLogin={() => setAuthPage('login')} /></>
    }
    return <>{joinTripId && <></>}<Login onSwitchToRegister={() => setAuthPage('register')} /></>
  }

  // Inside a trip
  if (selectedTripId) {
    return (
      <div className={`theme-${state.settings.theme}`} style={{ height: '100%' }}>
        <TripDetail
          tripId={selectedTripId}
          onBack={() => {
            setSelectedTripId(null)
            setAuthPage('login')
            localStorage.removeItem('kk-coincat-route-trip')
          }}
        />
        {joinDialog}
        {noticeDialog}
      </div>
    )
  }

  // Trip list (home)
  return (
    <div className={`app theme-${state.settings.theme}`}>
      <div className="top-bar">
        <div className="top-bar-left">
          <span className="top-bar-logo">🐈‍⬛</span>
          <span className="top-bar-title">KK CoinCat</span>
        </div>
        <div className="top-bar-right">
          <button
            className="btn-icon"
            onClick={() => updateSettings({ theme: state.settings.theme === 'dark' ? 'light' : 'dark' })}
            title="切換主題"
          >
            <FontAwesomeIcon icon={state.settings.theme === 'dark' ? faSun : faMoon} />
          </button>
          <button
            className="identity-badge"
            onClick={() => setShowSwitchUser(true)}
            style={state.auth.currentUser.color ? { backgroundColor: state.auth.currentUser.color, color: 'white' } : undefined}
          >
            {state.auth.currentUser.displayName}
          </button>
        </div>
      </div>
      <div className="app-content">
        <TripList onSelectTrip={(id) => {
          setSelectedTripId(id)
          localStorage.setItem('kk-coincat-route-trip', id)
        }} />
      </div>

      {showSwitchUser && <UserMenu onClose={() => setShowSwitchUser(false)} onSwitchUser={() => {
        setShowSwitchUser(false)
        setSelectedTripId(null)
        setAuthPage('login')
        localStorage.removeItem('kk-coincat-route-trip')
      }} />}
      {joinDialog}
      {noticeDialog}
    </div>
  )
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}

export default App
