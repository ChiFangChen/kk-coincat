import { useState } from 'react'
import { useApp } from '../context/AppContext'

interface Props {
  onClose: () => void
}

export function CreateTrip({ onClose }: Props) {
  const { state, addTrip } = useApp()
  const [name, setName] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    state.auth.currentUser ? [state.auth.currentUser.id] : []
  )

  const activeUsers = state.users.filter((u) => !u.deleted)

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || selectedMembers.length === 0) return
    addTrip(name.trim(), 'TWD', selectedMembers)
    onClose()
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>新增旅程</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div className="form-group">
            <label>旅程名稱</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}

              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>成員</label>
            <div className="member-select">
              {activeUsers.map((user) => (
                <label key={user.id} className="member-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(user.id)}
                    onChange={() => toggleMember(user.id)}
                  />
                  <span>{user.displayName}<span className="color-dot" style={{ backgroundColor: user.color }} /></span>
                  {user.id === state.auth.currentUser?.id && <span className="you-tag">你</span>}
                </label>
              ))}
            </div>
          </div>
          <div className="dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-primary">建立</button>
          </div>
        </form>
      </div>
    </div>
  )
}
