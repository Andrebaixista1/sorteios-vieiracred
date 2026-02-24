import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import ConfigPage from './pages/ConfigPage'
import LoginPage from './pages/LoginPage'
import PlayPage from './pages/PlayPage'
import logo from './assets/vieiracred-logo.png'

const themes = {
  dark: 'dark',
  light: 'light',
}
const AUTH_STORAGE_KEY = 'vieiracred_admin_authenticated'

function ThemeIcon({ theme }) {
  if (theme === themes.dark) {
    return (
      <svg
        className="theme-icon-svg"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4.5" fill="currentColor" />
        <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <line x1="12" y1="2.5" x2="12" y2="5.2" />
          <line x1="12" y1="18.8" x2="12" y2="21.5" />
          <line x1="2.5" y1="12" x2="5.2" y2="12" />
          <line x1="18.8" y1="12" x2="21.5" y2="12" />
          <line x1="5.2" y1="5.2" x2="7.2" y2="7.2" />
          <line x1="16.8" y1="16.8" x2="18.8" y2="18.8" />
          <line x1="16.8" y1="7.2" x2="18.8" y2="5.2" />
          <line x1="5.2" y1="18.8" x2="7.2" y2="16.8" />
        </g>
      </svg>
    )
  }

  return (
    <svg className="theme-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20.2 14.4a8.6 8.6 0 0 1-10.6-10.6 1 1 0 0 0-1.3-1.2A10 10 0 1 0 21.4 15.7a1 1 0 0 0-1.2-1.3Z"
      />
    </svg>
  )
}

function App() {
  const [theme, setTheme] = useState(themes.dark)
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => sessionStorage.getItem(AUTH_STORAGE_KEY) === 'true',
  )
  const navigate = useNavigate()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((current) => (current === themes.dark ? themes.light : themes.dark))
  }

  const handleLoginSuccess = () => {
    sessionStorage.setItem(AUTH_STORAGE_KEY, 'true')
    setIsAuthenticated(true)
    navigate('/', { replace: true })
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <img src={logo} alt="Vieiracred" className="brand-logo" />
          <span className="brand-tagline">Sorteios Vieira 1.0</span>
        </div>
        <button
          className="theme-toggle"
          type="button"
          aria-label="Alternar tema"
          title={theme === themes.dark ? 'Ativar tema claro' : 'Ativar tema escuro'}
          onClick={toggleTheme}
        >
          <ThemeIcon theme={theme} />
        </button>
      </header>
      <main className="app-content">
        <Routes>
          <Route
            path="/"
            element={isAuthenticated ? <ConfigPage /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/login"
            element={
              isAuthenticated ? (
                <Navigate to="/" replace />
              ) : (
                <LoginPage onLoginSuccess={handleLoginSuccess} />
              )
            }
          />
          <Route path="/sorteios" element={<PlayPage />} />
          <Route path="/play" element={<Navigate to="/sorteios" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
