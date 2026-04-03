import { useState, useRef } from 'react'
import { useApp } from '../context/AppContext'

interface Props {
  onSwitchToRegister: () => void
}

export function Login({ onSwitchToRegister }: Props) {
  const { state, login, updateUser } = useApp()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showForgot, setShowForgot] = useState(false)
  const [forgotUsername, setForgotUsername] = useState('')
  const [forgotDisplayName, setForgotDisplayName] = useState('')
  const [forgotNewPassword, setForgotNewPassword] = useState('')
  const [forgotError, setForgotError] = useState('')
  const [forgotSuccess, setForgotSuccess] = useState(false)
  const tapCountRef = useRef(0)
  const tapTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const user = state.users.find(
      (u) => u.username === username && u.password === password && !u.deleted
    )
    if (user) {
      login(user)
    } else {
      setError('帳號或密碼錯誤')
    }
  }

  const handleLogoTap = () => {
    tapCountRef.current++
    clearTimeout(tapTimerRef.current)
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0
      setShowForgot(true)
    } else {
      tapTimerRef.current = setTimeout(() => {
        tapCountRef.current = 0
      }, 1500)
    }
  }

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setForgotError('')

    const user = state.users.find(
      (u) => u.username === forgotUsername && u.displayName === forgotDisplayName && !u.deleted
    )
    if (!user) {
      setForgotError('帳號或顯示名稱不正確')
      return
    }
    if (!forgotNewPassword) {
      setForgotError('請輸入新密碼')
      return
    }

    updateUser({ ...user, password: forgotNewPassword })
    setForgotSuccess(true)
  }

  return (
    <div className="identity-page">
      <div className="login-logo" onClick={handleLogoTap}>🐈‍⬛</div>
      <h1 className="identity-title">KK CoinCat</h1>
      <p className="identity-subtitle">旅行分帳好夥伴</p>

      {showForgot ? (
        forgotSuccess ? (
          <div className="auth-form">
            <p className="settings-hint" style={{ textAlign: 'center' }}>密碼已重置成功</p>
            <button
              type="button"
              className="btn btn-primary auth-btn"
              onClick={() => {
                setShowForgot(false)
                setForgotSuccess(false)
                setForgotUsername('')
                setForgotDisplayName('')
                setForgotNewPassword('')
              }}
            >
              返回登入
            </button>
          </div>
        ) : (
          <form onSubmit={handleForgotSubmit} className="auth-form">
            <div className="form-group">
              <label>帳號</label>
              <input
                type="text"
                value={forgotUsername}
                onChange={(e) => setForgotUsername(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
            <div className="form-group">
              <label>顯示名稱</label>
              <input
                type="text"
                value={forgotDisplayName}
                onChange={(e) => setForgotDisplayName(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
            <div className="form-group">
              <label>新密碼</label>
              <input
                type="password"
                value={forgotNewPassword}
                onChange={(e) => setForgotNewPassword(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
            {forgotError && <div className="auth-error">{forgotError}</div>}
            <button type="submit" className="btn btn-primary auth-btn">重置密碼</button>
            <button
              type="button"
              className="btn-link"
              onClick={() => {
                setShowForgot(false)
                setForgotError('')
              }}
            >
              返回登入
            </button>
          </form>
        )
      ) : (
        <>
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label>帳號</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
            <div className="form-group">
              <label>密碼</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button type="submit" className="btn btn-primary auth-btn">登入</button>
          </form>

          <button className="btn-link" onClick={onSwitchToRegister}>
            還沒有帳號？建立帳號
          </button>
        </>
      )}
    </div>
  )
}
