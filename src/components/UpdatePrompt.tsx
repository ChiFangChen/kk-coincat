import { useRegisterSW } from 'virtual:pwa-register/react'

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="update-prompt">
      <span>有新版本可用</span>
      <button className="btn btn-sm btn-primary" onClick={() => updateServiceWorker(true)}>
        更新
      </button>
    </div>
  )
}
