import { useState } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { TripList } from './pages/TripList'
import { TripDetail } from './pages/TripDetail'
import { UserMenu } from './components/UserMenu'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSun, faMoon } from '@fortawesome/free-solid-svg-icons'
import './App.css'

function AppContent() {
  const { state, updateSettings } = useApp()
  const [authPage, setAuthPage] = useState<'login' | 'register'>('login')
  const [selectedTripId, setSelectedTripId] = useState<string | null>(() => {
    return localStorage.getItem('kk-coincat-route-trip') || null
  })
  const [showSwitchUser, setShowSwitchUser] = useState(false)

  // Not logged in
  if (!state.auth.currentUser) {
    if (authPage === 'register') {
      return <Register onSwitchToLogin={() => setAuthPage('login')} />
    }
    return <Login onSwitchToRegister={() => setAuthPage('register')} />
  }

  // Inside a trip
  if (selectedTripId) {
    return (
      <div className={`theme-${state.settings.theme}`} style={{ height: '100%' }}>
        <TripDetail
          tripId={selectedTripId}
          onBack={() => {
            setSelectedTripId(null)
            localStorage.removeItem('kk-coincat-route-trip')
          }}
        />
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
        setSelectedTripId(null)
        localStorage.removeItem('kk-coincat-route-trip')
      }} />}
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
