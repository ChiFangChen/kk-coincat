import { useState } from 'react'
import { useApp } from '../context/AppContext'

interface Props {
  onCancel: () => void
}

export function SwitchUser({ onCancel }: Props) {
  const { state, login } = useApp()
  const [selectedUserId, setSelectedUserId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const otherUsers = state.users.filter(
    (u) => u.id !== state.auth.currentUser?.id
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const user = state.users.find(
      (u) => u.id === selectedUserId && u.password === password
    )
    if (user) {
      login(user)
      onCancel()
    } else {
      setError('密碼錯誤')
    }
  }

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>切換使用者</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div className="form-group">
            <label>選擇使用者</label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              required
            >
              <option value="">選擇...</option>
              {otherUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>密碼</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="輸入密碼"
              required
            />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <div className="dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>取消</button>
            <button type="submit" className="btn btn-primary">切換</button>
          </div>
        </form>
      </div>
    </div>
  )
}
