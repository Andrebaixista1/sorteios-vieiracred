import { useEffect, useMemo, useState } from 'react'
import BalloonGrid from '../components/BalloonGrid'
import ResultModal from '../components/ResultModal'
import { getPlaySummary, popBalloon, resetCodes } from '../services/api'

const COLORS = ['#3ed597', '#3cc7ff', '#f8b64c', '#ff5f7f', '#8462ff']
const helperText = 'Clique em um balão para estourar. O sorteio respeita a configuração salva.'

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function getBalloonGridColumns(total) {
  const amount = Number(total)
  if (!Number.isFinite(amount) || amount <= 1) return 1

  if (amount % 10 === 0) return 10

  let best = Math.min(amount, 8)
  let bestScore = Number.POSITIVE_INFINITY

  for (let candidate = 2; candidate <= Math.min(amount, 12); candidate += 1) {
    const rows = Math.ceil(amount / candidate)
    const emptySlots = candidate * rows - amount
    const shapePenalty = Math.abs(candidate - rows)
    const score = emptySlots * 10 + shapePenalty

    if (score < bestScore) {
      best = candidate
      bestScore = score
    }
  }

  return best
}

function getRemainingBalloonsFromResponse(response, fallbackTotal = 10) {
  const total = Number(response?.summary?.remaining_balloons)
  if (Number.isFinite(total)) {
    return Math.max(0, total)
  }

  const used = Number(response?.summary?.used_tokens)
  const configured = Number(response?.configuration?.total_balloons ?? fallbackTotal)
  if (Number.isFinite(used) && Number.isFinite(configured)) {
    return Math.max(0, configured - used)
  }

  return Math.max(0, fallbackTotal)
}

function PlayPage() {
  const [result, setResult] = useState(null)
  const [balloonResultValue, setBalloonResultValue] = useState(null)
  const [pendingFinalResult, setPendingFinalResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [popped, setPopped] = useState(false)
  const [burstIndex, setBurstIndex] = useState(null)
  const [playData, setPlayData] = useState(null)
  const [revealedValues, setRevealedValues] = useState([])
  const [resettingRound, setResettingRound] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)

  const configuredBalloons = useMemo(() => {
    const total = Number(playData?.configuration?.total_balloons ?? 0)
    return Number.isFinite(total) && total > 0 ? total : 10
  }, [playData])

  const summary = playData?.summary ?? null

  const remainingBalloons = useMemo(() => {
    const total = Number(summary?.remaining_balloons)
    if (Number.isFinite(total)) {
      return Math.max(0, total)
    }

    const usedTokens = Number(summary?.used_tokens)
    if (Number.isFinite(usedTokens)) {
      return Math.max(0, configuredBalloons - usedTokens)
    }

    return configuredBalloons
  }, [summary, configuredBalloons])

  const balloonGridColumns = useMemo(
    () => getBalloonGridColumns(configuredBalloons),
    [configuredBalloons],
  )

  useEffect(() => {
    refreshPlaySummary()
  }, [])

  async function refreshPlaySummary() {
    try {
      const response = await getPlaySummary()
      setPlayData(response)
      if (Number(response?.summary?.used_tokens ?? 0) === 0) {
        setRevealedValues([])
        setResult(null)
        setPendingFinalResult(null)
        setBalloonResultValue(null)
      }
      return response
    } catch (err) {
      setError((current) => current || err.message)
      return null
    }
  }

  async function handleBalloonPop(index) {
    if (loading || popped) return

    if (remainingBalloons <= 0) {
      setError('Não há mais balões disponíveis nesta rodada.')
      return
    }

    setLoading(true)
    setError('')
    setMessage('')
    setBurstIndex(index)

    try {
      const response = await popBalloon()
      await wait(550)
      const value = Number(response?.value ?? 0)
      const nextValue = Number.isFinite(value) ? value : 0
      const nextOutcome = {
        type: response?.result_type === 'prank' ? 'prank' : 'money',
        value: nextValue,
        prankLabel: response?.prank_label ?? null,
      }

      setPopped(true)
      const summaryResponse = await refreshPlaySummary()

      const nextResults = [...revealedValues, nextOutcome]
      setRevealedValues(nextResults)

      const nextRemaining = getRemainingBalloonsFromResponse(
        summaryResponse,
        configuredBalloons,
      )

      if (nextRemaining <= 0) {
        setPendingFinalResult({
          values: nextResults,
          totalAwarded:
            Number(summaryResponse?.summary?.awarded_total) ||
            nextResults.reduce((sum, item) => sum + Number(item?.value || 0), 0),
        })
        setBalloonResultValue(nextOutcome)
        setMessage('Rodada concluída. Veja o resultado final.')
      } else {
        setBalloonResultValue(nextOutcome)
        setMessage('Balão estourado. Continue até o fim para ver todos os resultados.')
      }
    } catch (err) {
      setError(err.message)
      setBurstIndex(null)
      setPopped(false)
    } finally {
      setLoading(false)
    }
  }

  function openResetModal() {
    if (loading || resettingRound) return

    setError('')
    setMessage('')
    setShowResetModal(true)
  }

  function closeResetModal() {
    if (resettingRound) return
    setShowResetModal(false)
  }

  async function confirmResetRound() {
    const configurationId = Number(playData?.configuration?.id)
    if (!Number.isFinite(configurationId) || configurationId <= 0) {
      setError('Configuração não encontrada para resetar a rodada.')
      return
    }

    if (loading || resettingRound) return

    setResettingRound(true)
    setError('')
    setMessage('')

    try {
      await resetCodes(configurationId, configuredBalloons)
      setResult(null)
      setPendingFinalResult(null)
      setBalloonResultValue(null)
      setPopped(false)
      setBurstIndex(null)
      setRevealedValues([])
      await refreshPlaySummary()
      setMessage('Rodada resetada com sucesso.')
      setShowResetModal(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setResettingRound(false)
    }
  }

  function closeResult() {
    if (balloonResultValue !== null) {
      setBalloonResultValue(null)
      setBurstIndex(null)

      if (pendingFinalResult) {
        setResult(pendingFinalResult)
        setPendingFinalResult(null)
        return
      }

      setPopped(false)
      return
    }

    setResult(null)
    setPopped(false)
    setBurstIndex(null)
  }

  return (
    <section className="panel play-panel">
      <div className="play-layout">
        <div className="play-main">
          <div className="play-card">
            <p className="stage-title">Dia do Fechamento</p>
            <p className="stage-subtitle">{helperText}</p>
            <div className="play-stats-grid">
              <div className="play-stat-box compact">
                <span className="small-text">Total de balões</span>
                <strong>{configuredBalloons}</strong>
              </div>
              <div className="play-stat-box compact">
                <span className="small-text">Saldo total</span>
                <strong>{formatCurrency(playData?.configuration?.total_value)}</strong>
              </div>
            </div>
            <div className="play-card-actions">
              <button
                type="button"
                className="ghost-button small"
                onClick={openResetModal}
                disabled={loading || resettingRound}
              >
                {resettingRound ? 'Resetando...' : 'Resetar tokens'}
              </button>
            </div>
            {message && <p className="status-message">{message}</p>}
            {error && <p className="status-message error">{error}</p>}
          </div>

          <div className="balloon-stage">
            {configuredBalloons > 0 ? (
              <BalloonGrid
                total={remainingBalloons}
                slotsTotal={configuredBalloons}
                columns={balloonGridColumns}
                colors={COLORS}
                onPop={handleBalloonPop}
                disabled={loading || popped || remainingBalloons <= 0}
                burstIndex={burstIndex}
              />
            ) : (
              <div className="balloon-placeholder">
                <p>Salve uma configuração com pelo menos 1 balão para começar.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ResultModal
        value={balloonResultValue}
        results={result?.values ?? null}
        totalValue={result?.totalAwarded ?? null}
        onClose={closeResult}
      />

      {showResetModal && (
        <div className="modal-overlay" onClick={closeResetModal}>
          <div
            className="result-card confirm-card"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="modal-flag">Resetar Rodada</p>
            <p className="confirm-text">
              Isso vai resetar a rodada atual e gerar novamente {configuredBalloons}{' '}
              registros para o sorteio. Deseja continuar?
            </p>

            <div className="confirm-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={closeResetModal}
                disabled={resettingRound}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={confirmResetRound}
                disabled={resettingRound}
              >
                {resettingRound ? 'Resetando...' : 'Confirmar reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default PlayPage
