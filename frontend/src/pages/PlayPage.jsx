import { useEffect, useMemo, useState } from 'react'
import BalloonGrid from '../components/BalloonGrid'
import ResultModal from '../components/ResultModal'
import { checkToken, validateCode, getPlaySummary } from '../services/api'

const COLORS = ['#3ed597', '#3cc7ff', '#f8b64c', '#ff5f7f', '#8462ff']
const helperText = 'Digite o token recebido para liberar os balões'

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

function PlayPage() {
  const [inputCode, setInputCode] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [tokenValidated, setTokenValidated] = useState(false)
  const [popped, setPopped] = useState(false)
  const [playData, setPlayData] = useState(null)
  const [sidebarLoading, setSidebarLoading] = useState(false)

  const configuredBalloons = useMemo(() => {
    const total = Number(playData?.configuration?.total_balloons ?? 0)
    return Number.isFinite(total) && total > 0 ? total : 40
  }, [playData])

  const summary = playData?.summary ?? null
  const recentUsed = playData?.recent_used ?? []

  useEffect(() => {
    refreshPlaySummary()
  }, [])

  async function refreshPlaySummary() {
    setSidebarLoading(true)
    try {
      const response = await getPlaySummary()
      setPlayData(response)
    } catch (err) {
      setError((current) => current || err.message)
    } finally {
      setSidebarLoading(false)
    }
  }

  async function handleTokenSubmit(event) {
    event.preventDefault()
    const code = inputCode.toUpperCase().trim()

    if (!code) {
      setError('Informe um código antes de continuar')
      return
    }

    setLoading(true)
    setError('')
    setMessage('')
    setPopped(false)

    try {
      await checkToken(code)
      setTokenValidated(true)
      setMessage('Token válido! Escolha um balão para estourar.')
      await refreshPlaySummary()
    } catch (err) {
      setError(err.message)
      setTokenValidated(false)
    } finally {
      setLoading(false)
    }
  }

  async function handleBalloonPop() {
    if (!tokenValidated || popped) return

    setLoading(true)
    setError('')
    setMessage('')

    try {
      const response = await validateCode(inputCode.toUpperCase().trim())
      const value = Number(response.value)

      setResult(response)
      setMessage(
        value > 0
          ? `Prêmio liberado: ${formatCurrency(value)}`
          : 'Balão estourado: sem prêmio desta vez.',
      )
      setPopped(true)
      setTokenValidated(false)
      await refreshPlaySummary()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function closeResult() {
    setResult(null)
  }

  return (
    <section className="panel play-panel">
      <div className="play-layout">
        <div className="play-main">
          <div className="play-card">
            <p className="stage-title">Dia do Fechamento</p>
            <p className="stage-subtitle">{helperText}</p>
            <form className="code-form" onSubmit={handleTokenSubmit}>
              <input
                type="text"
                maxLength="6"
                placeholder="A3K9"
                value={inputCode}
                onChange={(event) => setInputCode(event.target.value)}
                className="input-field code-input"
                disabled={popped}
              />
              <button className="primary-button" disabled={loading || popped}>
                {loading ? 'Validando...' : 'Entrar'}
              </button>
            </form>
            {message && <p className="status-message">{message}</p>}
            {error && <p className="status-message error">{error}</p>}
          </div>

          <div className="balloon-stage">
            {tokenValidated && !popped ? (
              <BalloonGrid
                total={configuredBalloons}
                columns={7}
                colors={COLORS}
                onPop={handleBalloonPop}
                disabled={loading}
              />
            ) : (
              <div className="balloon-placeholder">
                <p>Insira o token válido para liberar os balões.</p>
              </div>
            )}
          </div>
        </div>

        <aside className="play-sidebar">
          <div className="play-sidebar-card">
            <div className="play-sidebar-header">
              <h3>Painel da Rodada</h3>
              {sidebarLoading && <span className="small-text">Atualizando...</span>}
            </div>

            <div className="play-stats-grid">
              <div className="play-stat-box">
                <span className="small-text">Balões configurados</span>
                <strong>{configuredBalloons}</strong>
              </div>
              <div className="play-stat-box">
                <span className="small-text">Saldo total</span>
                <strong>{formatCurrency(playData?.configuration?.total_value)}</strong>
              </div>
              <div className="play-stat-box">
                <span className="small-text">Distribuído</span>
                <strong>{formatCurrency(summary?.awarded_total)}</strong>
              </div>
              <div className="play-stat-box">
                <span className="small-text">Restante</span>
                <strong>{formatCurrency(summary?.remaining_total)}</strong>
              </div>
            </div>

            <div className="play-stats-grid">
              <div className="play-stat-box compact">
                <span className="small-text">Tokens usados</span>
                <strong>{summary?.used_tokens ?? 0}</strong>
              </div>
              <div className="play-stat-box compact">
                <span className="small-text">Tokens pendentes</span>
                <strong>{summary?.pending_tokens ?? 0}</strong>
              </div>
            </div>

            <div className="play-history">
              <div className="play-sidebar-header">
                <h4>Últimos tokens usados</h4>
              </div>

              {recentUsed.length === 0 ? (
                <p className="tokens-empty play-history-empty">
                  Nenhum token usado ainda.
                </p>
              ) : (
                <div className="play-history-list">
                  {recentUsed.map((item) => (
                    <div key={`${item.id}-${item.code}`} className="play-history-item">
                      <div>
                        <strong>{item.code}</strong>
                        <p className="small-text">
                          {item.value > 0 ? 'Premiado' : 'Sem prêmio'}
                        </p>
                      </div>
                      <strong>{item.value > 0 ? formatCurrency(item.value) : 'R$ 0'}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      <ResultModal value={result?.value ?? null} onClose={closeResult} />
    </section>
  )
}

export default PlayPage
