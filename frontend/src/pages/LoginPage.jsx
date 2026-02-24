import { useState } from 'react'

const DEFAULT_USER = 'admin'
const DEFAULT_PASSWORD = 'Vieir@8996!2026'

function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(event) {
    event.preventDefault()

    if (username === DEFAULT_USER && password === DEFAULT_PASSWORD) {
      onLoginSuccess()
      return
    }

    setError('Usuário ou senha inválidos')
  }

  return (
    <section className="login-shell">
      <div className="login-card">
        <p className="login-eyebrow">Acesso restrito</p>
        <h1 className="login-title">Entrar na Configuração</h1>
        <p className="login-subtitle">
          Digite seu usuário e senha para acessar o painel administrativo.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-label" htmlFor="login-user">
            Usuário
          </label>
          <input
            id="login-user"
            type="text"
            className="input-field login-input"
            value={username}
            onChange={(event) => {
              setUsername(event.target.value)
              setError('')
            }}
            autoComplete="username"
            autoFocus
          />

          <label className="login-label" htmlFor="login-password">
            Senha
          </label>
          <input
            id="login-password"
            type="password"
            className="input-field login-input"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              setError('')
            }}
            autoComplete="current-password"
          />

          {error && <p className="status-message error">{error}</p>}

          <button type="submit" className="primary-button login-submit">
            Entrar
          </button>
        </form>
      </div>
    </section>
  )
}

export default LoginPage
