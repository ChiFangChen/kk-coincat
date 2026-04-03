import { useState } from 'react'
import { useApp } from '../context/AppContext'

interface Props {
  onSwitchToRegister: () => void
}

export function Login({ onSwitchToRegister }: Props) {
  const { state, login } = useApp()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const user = state.users.find(
      (u) => u.username === username && u.password === password
    )
    if (user) {
      login(user)
    } else {
      setError('帳號或密碼錯誤')
    }
  }

  return (
    <div className="identity-page">
      <div className="login-logo">🐈‍⬛</div>
      <h1 className="identity-title">KK CoinCat</h1>
      <p className="identity-subtitle">旅行分帳好夥伴</p>

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label>帳號</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="輸入帳號"
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
            placeholder="輸入密碼"
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
    </div>
  )
}
