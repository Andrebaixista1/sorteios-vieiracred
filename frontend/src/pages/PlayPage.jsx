import { useMemo, useState } from 'react'
import BalloonGrid from '../components/BalloonGrid'
import ResultModal from '../components/ResultModal'
import { checkToken, validateCode } from '../services/api'

const COLORS = ['#3ed597', '#3cc7ff', '#f8b64c', '#ff5f7f', '#8462ff']
const helperText = 'Digite o token recebido para liberar os balões'

function PlayPage() {
  const [inputCode, setInputCode] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [tokenValidated, setTokenValidated] = useState(false)
  const [popped, setPopped] = useState(false)

  const balloonRows = useMemo(
    () => Math.max(3, Math.min(7, Math.ceil(inputCode.length / 2) + 4)),
    [inputCode],
  )

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
          ? `Prêmio liberado: ${value.toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}`
          : 'Balão estourado: sem prêmio desta vez.',
      )
      setPopped(true)
      setTokenValidated(false)
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
            rows={balloonRows}
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

      <ResultModal value={result?.value ?? null} onClose={closeResult} />
    </section>
  )
}

export default PlayPage
