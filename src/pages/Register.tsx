import { useState } from 'react'
import { useApp } from '../context/AppContext'

interface Props {
  onSwitchToLogin: () => void
}

export function Register({ onSwitchToLogin }: Props) {
  const { state, register, login } = useApp()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (state.users.some((u) => u.username === username)) {
      setError('帳號已存在')
      return
    }

    const user = await register(username, password, displayName || username)
    login(user)
  }

  return (
    <div className="identity-page">
      <div className="login-logo">🐈‍⬛</div>
      <h1 className="identity-title">建立帳號</h1>
      <p className="identity-subtitle">加入 KK CoinCat</p>

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
        <div className="form-group">
          <label>顯示名稱</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="例如：Kiki"
          />
        </div>
        {error && <div className="auth-error">{error}</div>}
        <button type="submit" className="btn btn-primary auth-btn">建立帳號</button>
      </form>

      <button className="btn-link" onClick={onSwitchToLogin}>
        已有帳號？登入
      </button>
    </div>
  )
}
