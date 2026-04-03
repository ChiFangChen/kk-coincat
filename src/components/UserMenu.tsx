import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { SwitchUser } from '../pages/SwitchUser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSync } from '@fortawesome/free-solid-svg-icons'

interface Props {
  onClose: () => void
}

export function UserMenu({ onClose }: Props) {
  const { state, updateUser } = useApp()
  const currentUser = state.auth.currentUser
  const [showSwitchUser, setShowSwitchUser] = useState(false)

  if (!currentUser) return null

  if (showSwitchUser) {
    return <SwitchUser onCancel={onClose} />
  }

  const handleColorChange = (color: string) => {
    updateUser({ ...currentUser, color })
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="user-menu-header">
          <h3>{currentUser.displayName}</h3>
          <label className="color-picker-btn" style={{ backgroundColor: currentUser.color }}>
            <FontAwesomeIcon icon={faSync} className="color-picker-icon" />
            <input
              type="color"
              value={currentUser.color || '#888888'}
              onChange={(e) => handleColorChange(e.target.value)}
              className="color-input-hidden"
            />
          </label>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          style={{ width: '100%' }}
          onClick={() => setShowSwitchUser(true)}
        >
          切換使用者
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          style={{ width: '100%' }}
          onClick={onClose}
        >
          關閉
        </button>
      </div>
    </div>
  )
}
