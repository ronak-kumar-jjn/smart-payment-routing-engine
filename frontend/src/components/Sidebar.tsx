'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  {
    section: 'Overview',
    items: [
      { label: 'Dashboard', href: '/', icon: '📊' },
      { label: 'Transactions', href: '/transactions', icon: '💳' },
    ],
  },
  {
    section: 'Intelligence',
    items: [
      { label: 'Fraud Monitor', href: '/fraud', icon: '🛡️' },
      { label: 'Routing Engine', href: '/routing', icon: '🔀' },
    ],
  },
  {
    section: 'Analytics',
    items: [
      { label: 'Analytics', href: '/analytics', icon: '📈' },
      { label: 'A/B Testing', href: '/ab-testing', icon: '🧪' },
    ],
  },
  {
    section: 'System',
    items: [
      { label: 'Gateways', href: '/gateways', icon: '🏦' },
      { label: 'Health', href: '/health', icon: '💚' },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="logo-icon">⚡</div>
          <div>
            <div className="logo-text">SmartRoute</div>
            <div className="logo-sub">Payment Router</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((section) => (
          <div key={section.section} className="nav-section">
            <div className="nav-section-label">{section.section}</div>
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${pathname === item.href ? 'active' : ''}`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="status-dot active"></span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>All systems operational</span>
        </div>
      </div>
    </aside>
  );
}
