import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { ConfirmDialog } from './ConfirmDialog'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSync, faTrash, faCheck, faTimes } from '@fortawesome/free-solid-svg-icons'

interface Props {
  onClose: () => void
  onSwitchUser?: () => void
}

const ADMIN_SESSION_KEY = 'kk-coincat-admin-session'

export function UserMenu({ onClose, onSwitchUser }: Props) {
  const { state, login, logout, updateUser, deleteUser, register, isCurrentUserAdmin } = useApp()
  const currentUser = state.auth.currentUser
  const admin = isCurrentUserAdmin()
  const [view, setView] = useState<'menu' | 'register' | 'manage' | 'switch' | 'resetpw'>('menu')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [regError, setRegError] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [resetSuccess, setResetSuccess] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  if (!currentUser) return null

  const handleColorChange = (color: string) => {
    updateUser({ ...currentUser, color })
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegError('')

    if (!username.trim()) {
      setRegError('請輸入帳號')
      return
    }

    if (state.users.some((u) => u.username === username && !u.deleted)) {
      setRegError('帳號已存在')
      return
    }

    await register(username, password, displayName || username)
    setUsername('')
    setPassword('')
    setDisplayName('')
    setView('menu')
  }

  const handleSaveName = (userId: string) => {
    const user = state.users.find((u) => u.id === userId)
    if (user && editingName.trim() && editingName.trim() !== user.displayName) {
      updateUser({ ...user, displayName: editingName.trim() })
    }
    setEditingUserId(null)
  }

  const handleDeleteUser = (userId: string) => {
    deleteUser(userId)
    setConfirmDelete(null)
    // If deleting the current user (admin viewing as this user), switch back to admin
    if (userId === currentUser.id && adminSessionId) {
      handleSwitchBackToAdmin()
    }
  }

  const adminSessionId = localStorage.getItem(ADMIN_SESSION_KEY)

  const handleSwitchUser = (user: typeof currentUser) => {
    if (!user) return
    // If current user is admin and switching to someone else, store admin session
    if (admin && !adminSessionId) {
      localStorage.setItem(ADMIN_SESSION_KEY, currentUser.id)
    }
    login(user)
    onClose()
    onSwitchUser?.()
  }

  const handleSwitchBackToAdmin = () => {
    if (!adminSessionId) return
    const adminUser = state.users.find((u) => u.id === adminSessionId)
    if (!adminUser) return
    localStorage.removeItem(ADMIN_SESSION_KEY)
    login(adminUser)
    onClose()
    onSwitchUser?.()
  }

  const activeUsers = state.users.filter((u) => !u.deleted)
  const isAdminSession = admin || !!adminSessionId
  const otherUsers = activeUsers.filter((u) => u.id !== currentUser.id)
  // Find the real admin user ID (isAdmin flag or earliest user as fallback)
  const sortedUsers = [...state.users].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const realAdminId = state.users.find((u) => u.isAdmin)?.id || sortedUsers[0]?.id
  const deleteTarget = confirmDelete ? state.users.find((u) => u.id === confirmDelete) : null

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        {view === 'menu' && (
          <>
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

            {adminSessionId && (
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={handleSwitchBackToAdmin}
              >
                返回管理員
              </button>
            )}

            {isAdminSession && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%' }}
                onClick={() => setView('manage')}
              >
                管理使用者
              </button>
            )}

            {isAdminSession && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%' }}
                onClick={() => setView('register')}
              >
                新增使用者
              </button>
            )}

            {isAdminSession && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%' }}
                onClick={() => setView('switch')}
              >
                切換使用者
              </button>
            )}

            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%' }}
              onClick={() => {
                setNewPassword('')
                setResetSuccess(false)
                setView('resetpw')
              }}
            >
              重置密碼
            </button>

            <button
              type="button"
              className="btn btn-warning"
              style={{ width: '100%' }}
              onClick={() => {
                localStorage.removeItem(ADMIN_SESSION_KEY)
                localStorage.removeItem('kk-coincat-route-trip')
                logout()
                onSwitchUser?.()
              }}
            >
              登出
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%' }}
              onClick={onClose}
            >
              關閉
            </button>
          </>
        )}

        {view === 'register' && (
          <>
            <h3>新增使用者</h3>
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div className="form-group">
                <label>帳號</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="off"
                  autoFocus
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
              <div className="form-group">
                <label>顯示名稱</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              {regError && <div className="auth-error">{regError}</div>}
              <div className="dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setView('menu')}>取消</button>
                <button type="submit" className="btn btn-primary">建立</button>
              </div>
            </form>
          </>
        )}

        {view === 'manage' && (
          <>
            <h3>管理使用者</h3>
            <div className="member-list-settings">
              {activeUsers.map((u) => (
                <div key={u.id} className="member-row">
                  <span className="color-dot" style={{ backgroundColor: u.color, marginRight: '0.5rem' }} />
                  {editingUserId === u.id ? (
                    <>
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="rate-edit-input"
                        autoFocus
                        style={{ flex: 1 }}
                      />
                      <button
                        className="btn-icon"
                        onClick={() => setEditingUserId(null)}
                        title="取消"
                      >
                        <FontAwesomeIcon icon={faTimes} />
                      </button>
                      <button
                        className="btn-icon btn-save"
                        onClick={() => handleSaveName(u.id)}
                        title="儲存"
                      >
                        <FontAwesomeIcon icon={faCheck} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span
                        style={{ flex: 1, cursor: 'pointer' }}
                        onClick={() => {
                          setEditingUserId(u.id)
                          setEditingName(u.displayName)
                        }}
                      >
                        {u.displayName}
                      </span>
                      {u.id !== realAdminId && (u.id !== currentUser.id || !!adminSessionId) && (
                        <button
                          className="btn-icon btn-delete"
                          onClick={() => setConfirmDelete(u.id)}
                          title="刪除"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setView('menu')}>返回</button>
            </div>
          </>
        )}

        {view === 'switch' && (
          <>
            <h3>切換使用者</h3>
            <div className="member-list-settings">
              {otherUsers.map((u) => (
                <button
                  key={u.id}
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                  onClick={() => handleSwitchUser(u)}
                >
                  <span className="color-dot" style={{ backgroundColor: u.color, marginRight: '0.5rem' }} />
                  {u.displayName}
                </button>
              ))}
              {otherUsers.length === 0 && (
                <div className="empty-state" style={{ padding: '1rem 0' }}>沒有其他使用者</div>
              )}
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setView('menu')}>返回</button>
            </div>
          </>
        )}

        {view === 'resetpw' && (
          <>
            <h3>重置密碼</h3>
            {resetSuccess ? (
              <>
                <p className="settings-hint">密碼已重置成功</p>
                <div className="dialog-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setView('menu')}>返回</button>
                </div>
              </>
            ) : (
              <form onSubmit={(e) => {
                e.preventDefault()
                if (!newPassword) return
                updateUser({ ...currentUser, password: newPassword })
                setResetSuccess(true)
              }} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div className="form-group">
                  <label>新密碼</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="off"
                    autoFocus
                    required
                  />
                </div>
                <div className="dialog-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setView('menu')}>取消</button>
                  <button type="submit" className="btn btn-primary">確認</button>
                </div>
              </form>
            )}
          </>
        )}
      </div>

      {confirmDelete && deleteTarget && (
        <ConfirmDialog
          title="刪除使用者"
          message={`確定要刪除「${deleteTarget.displayName}」嗎？此使用者將無法再登入，但過去的帳務紀錄會保留。`}
          confirmText="刪除"
          onConfirm={() => handleDeleteUser(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
