import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const navItems = [
  { path: '/dashboard',  icon: '📊', key: 'dashboard',        adminOnly: false },
  { path: '/flats',      icon: '🏠', key: 'flat_directory',   adminOnly: false },
  { path: '/maintenance',icon: '🔧', key: 'maintenance',      adminOnly: false },
  { path: '/outstanding',icon: '⚠️', key: 'outstanding',      adminOnly: false },
  { path: '/ledger',     icon: '📒', key: 'ledger',           adminOnly: false },
  { path: '/reports',    icon: '📄', key: 'reports',          adminOnly: false },
  { path: '/documents',  icon: '📁', key: 'documents',        adminOnly: false },
  { path: '/users',      icon: '👥', key: 'user_management',  adminOnly: true  },
  { path: '/notices',    icon: '📢', key: 'notices',          adminOnly: true  },
  { path: '/reminders',  icon: '🔔', key: 'reminders',        adminOnly: true  },
  { path: '/settings',   icon: '⚙️', key: 'settings',         adminOnly: true  },
];

export default function Layout({ children }) {
  const { t, i18n } = useTranslation();
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleLang = () => {
    const next = i18n.language === 'mr' ? 'en' : 'mr';
    i18n.changeLanguage(next);
    localStorage.setItem('lang', next);
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const items = navItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-gradient-to-b from-blue-900 to-blue-800 text-white flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Logo */}
        <div className="p-5 border-b border-blue-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">🏢</div>
            <div>
              <p className="font-bold text-sm leading-tight">{t('app_name')}</p>
              <p className="text-blue-300 text-xs">{isAdmin ? t('admin') : t('user')}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {items.map(item => (
            <Link key={item.path} to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                location.pathname === item.path
                  ? 'bg-white/20 text-white shadow-sm'
                  : 'text-blue-200 hover:bg-white/10 hover:text-white'
              }`}>
              <span className="text-lg">{item.icon}</span>
              {t(item.key)}
            </Link>
          ))}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-blue-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center font-bold text-sm">
              {(user?.name || user?.username || 'U')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || user?.username}</p>
              <p className="text-blue-300 text-xs">{isAdmin ? '🔐 Admin' : '🏠 Resident'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full bg-white/10 hover:bg-white/20 text-white text-sm py-2 rounded-lg transition">
            🚪 {t('logout')}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden text-gray-500 hover:text-gray-700 p-1">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h2 className="font-semibold text-gray-800 text-lg">
              {items.find(i => i.path === location.pathname) ? t(items.find(i => i.path === location.pathname).key) : ''}
            </h2>
          </div>
          <button onClick={toggleLang}
            className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full font-medium transition">
            {i18n.language === 'mr' ? '🌐 English' : '🌐 मराठी'}
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
