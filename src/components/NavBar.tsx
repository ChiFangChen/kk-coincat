import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faReceipt, faCalculator, faCog, faUser } from '@fortawesome/free-solid-svg-icons'

type Tab = 'expenses' | 'myExpenses' | 'settlement' | 'settings'

interface Props {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

export function NavBar({ activeTab, onTabChange }: Props) {
  const tabs: { id: Tab; label: string; icon: typeof faReceipt }[] = [
    { id: 'expenses', label: '帳務', icon: faReceipt },
    { id: 'myExpenses', label: '我的', icon: faUser },
    { id: 'settlement', label: '結算', icon: faCalculator },
    { id: 'settings', label: '設定', icon: faCog },
  ]

  return (
    <nav className="navbar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`navbar-tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          <span className="navbar-icon">
            <FontAwesomeIcon icon={tab.icon} />
          </span>
          <span className="navbar-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
