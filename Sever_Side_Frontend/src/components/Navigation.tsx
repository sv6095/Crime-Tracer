// src/components/Navigation.tsx
import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  FileText,
  Search,
  Settings,
  Menu,
  X,
  LogIn,
  LogOut,
  User,
  Home,
  BarChart3,
  LayoutDashboard
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import LanguageSwitcher from './LanguageSwitcher'

const Navigation: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { user, logout, isAuthenticated } = useAuth()
  const { t } = useTranslation()

  const isAdmin = user && (user.role === 'admin' || user.role === 'ADMIN' || (user as any).is_admin)
  const isCop =
    user && (user.role === 'police' || user.role === 'COP' || (user as any).is_cop)

  const getNavigationItems = () => {
    // Not logged in → just basic items + police auth
    if (!isAuthenticated || !user) {
      return [
        { path: '/', labelKey: 'nav.home', icon: Home },
        { path: '/cop/login', labelKey: 'nav.officerLogin', icon: LogIn }
      ]
    }

    // Logged-in admin
    if (isAdmin) {
      return [
        { path: '/', labelKey: 'nav.home', icon: Home },
        { path: '/cop/dashboard', labelKey: 'nav.copDashboard', icon: LayoutDashboard },
        { path: '/admin-governance-secret', labelKey: 'nav.adminPortal', icon: Settings },
        { path: '/admin/stats', labelKey: 'nav.globalStats', icon: BarChart3 }
      ]
    }

    // Logged-in cop
    if (isCop) {
      return [
        { path: '/', labelKey: 'nav.home', icon: Home },
        { path: '/cop/dashboard', labelKey: 'nav.copDashboard', icon: LayoutDashboard },
        { path: '/cop/stats', labelKey: 'nav.stationStats', icon: BarChart3 }
      ]
    }

    // Fallback
    return [{ path: '/', labelKey: 'nav.home', icon: Home }]
  }

  const navigationItems = getNavigationItems()

  const handleLogout = () => {
    logout()
    navigate('/')
    setIsMobileMenuOpen(false)
  }

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen)

  const goToProfile = () => {
    navigate('/profile')
    setIsMobileMenuOpen(false)
  }

  return (
    <nav
      className="sticky top-0 z-50 border-b glass-effect backdrop-blur-md"
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* LOGO */}
          <Link to="/" className="flex items-center space-x-2">
            <img
              src="/Logo.webp"
              alt="CrimeTracer Logo"
              className="w-9 h-9 rounded-lg object-contain"
            />
            <span
              className="text-xl font-bold"
              style={{ color: 'var(--text-on-dark)' }}
            >
              CrimeTracer
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            {navigationItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all
                    ${isActive
                      ? 'bg-white/10 text-white'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                >
                  <Icon size={16} />
                  <span>{t(item.labelKey)}</span>
                </Link>
              )
            })}

            {/* User Menu (desktop) */}
            {isAuthenticated && user && (
              <div className="flex items-center space-x-3 pl-4 border-l border-white/10">
                <button
                  type="button"
                  onClick={goToProfile}
                  className="flex items-center space-x-2 group"
                >
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30 transition-all">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-sm text-white/90 text-left">
                    <div className="font-medium group-hover:underline">
                      {user.name}
                    </div>
                    <div className="text-[10px] text-white/60">
                      {isAdmin
                        ? 'Admin'
                        : isCop
                          ? 'Police'
                          : 'User'}
                    </div>
                  </div>
                </button>

                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-white/70 hover:text-red-400 hover:bg-red-900/30 rounded-md transition-all"
                >
                  <LogOut size={16} />
                  <span>{t('nav.logout')}</span>
                </button>
              </div>
            )}

            {/* Language Switcher */}
            <LanguageSwitcher className="ml-2" />
          </div>

          {/* Mobile menu button */}
          <button
            onClick={toggleMobileMenu}
            className="md:hidden p-2 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-all"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-white/10 bg-black/40 backdrop-blur-lg">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {/* User info on mobile */}
            {isAuthenticated && user && (
              <button
                type="button"
                onClick={goToProfile}
                className="w-full px-3 py-3 border-b border-white/10 mb-2 text-white/80 text-left"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-[11px] text-white/60">
                      {isAdmin
                        ? 'Admin'
                        : isCop
                          ? 'Police'
                          : 'User'}
                    </div>
                  </div>
                </div>
              </button>
            )}

            {navigationItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-md text-base transition-all
                    ${isActive
                      ? 'bg-white/10 text-white'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                >
                  <Icon size={18} />
                  <span>{t(item.labelKey)}</span>
                </Link>
              )
            })}

            {/* Logout (mobile) */}
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="flex items-center space-x-3 px-3 py-2 rounded-md text-base text-white/70 hover:text-red-400 hover:bg-red-900/30 transition-all w-full"
              >
                <LogOut size={18} />
                <span>{t('nav.logout')}</span>
              </button>
            )}

            {/* Login link for unauthenticated mobile */}
            {!isAuthenticated && (
              <Link
                to="/cop/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center space-x-3 px-3 py-2 rounded-md text-base text-white/70 hover:text-white hover:bg-white/10 transition-all w-full"
              >
                <LogIn size={18} />
                <span>{t('nav.officerLogin')}</span>
              </Link>
            )}

            {/* Language Switcher (mobile) */}
            <div className="px-3 py-2 border-t border-white/10 mt-2 pt-3">
              <LanguageSwitcher variant="compact" />
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}

export default Navigation
