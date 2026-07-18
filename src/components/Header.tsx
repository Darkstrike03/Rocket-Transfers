import { useState, useCallback, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Lottie from 'lottie-react'
import { useTheme } from '../context/ThemeContext'
import rocketAnimation from './assets/Rocket in Space (Transparent Background).json'

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/upload', label: 'Upload' },
  { to: '/download', label: 'Download' },
  { to: '/ghostlink', label: 'Ghostlink' },
]

export default function Header() {
  const { theme, toggle } = useTheme()
  const [open, setOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  const handleHomeClick = useCallback(() => {
    if (window.location.pathname === '/') {
      window.location.reload()
    } else {
      window.location.href = '/'
    }
  }, [])

  return (
    <nav className="sticky top-0 z-50 glass border-b border-gray-200 dark:border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <button
            onClick={handleHomeClick}
            className="flex items-center gap-2 bg-transparent border-none cursor-pointer shrink-0"
            aria-label="Home"
          >
            <Lottie animationData={rocketAnimation} loop style={{ width: 30, height: 30 }} />
            <span className="text-base sm:text-lg font-bold tracking-tight text-gray-900 dark:text-white">
              ROCKET <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-purple to-accent-cyan hidden xs:inline">Transfers</span>
            </span>
          </button>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100/80 transition-all duration-200 dark:text-white/70 dark:hover:text-white dark:hover:bg-white/5"
              >
                {link.label}
              </Link>
            ))}
            <button
              onClick={toggle}
              className="ml-2 p-2 rounded-xl glass glass-hover text-sm leading-none"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>

          {/* Mobile hamburger + theme */}
          <div className="flex sm:hidden items-center gap-2">
            <button
              onClick={toggle}
              className="p-2 rounded-xl glass glass-hover text-sm leading-none"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button
              onClick={() => setOpen(!open)}
              className="p-2 rounded-xl glass glass-hover"
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {open ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {open && (
          <div className="sm:hidden pb-3 animate-fade-in">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="block px-4 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100/80 transition-all duration-200 dark:text-white/70 dark:hover:text-white dark:hover:bg-white/5"
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}
