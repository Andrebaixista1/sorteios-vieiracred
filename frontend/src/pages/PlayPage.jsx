import { useEffect, useMemo, useState } from 'react'
import BalloonGrid from '../components/BalloonGrid'
import ResultModal from '../components/ResultModal'
import { getPlaySummary, popBalloon } from '../services/api'

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

function PlayPage() {
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [popped, setPopped] = useState(false)
  const [burstIndex, setBurstIndex] = useState(null)
  const [playData, setPlayData] = useState(null)
  const [sidebarLoading, setSidebarLoading] = useState(false)

  const configuredBalloons = useMemo(() => {
    const total = Number(playData?.configuration?.total_balloons ?? 0)
    return Number.isFinite(total) && total > 0 ? total : 10
  }, [playData])

  const summary = playData?.summary ?? null
  const recentUsed = playData?.recent_used ?? []

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

  const poppedBalloons = Math.max(0, configuredBalloons - remainingBalloons)

  const balloonGridColumns = useMemo(
    () => getBalloonGridColumns(configuredBalloons),
    [configuredBalloons],
  )

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
      const [response] = await Promise.all([popBalloon(), wait(550)])
      const value = Number(response?.value ?? 0)

      setPopped(true)
      await refreshPlaySummary()
      setResult(response)
      setMessage(
        value > 0
          ? `Prêmio liberado: ${formatCurrency(value)}`
          : 'Balão estourado: sem prêmio desta vez.',
      )
    } catch (err) {
      setError(err.message)
      setBurstIndex(null)
    } finally {
      setLoading(false)
    }
  }

  function closeResult() {
    setResult(null)
    setPopped(false)
    setBurstIndex(null)
    setMessage('')
    setError('')
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
                <span className="small-text">Balões configurados</span>
                <strong>{configuredBalloons}</strong>
              </div>
              <div className="play-stat-box compact">
                <span className="small-text">Balões restantes</span>
                <strong>{remainingBalloons}</strong>
              </div>
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
                <span className="small-text">Balões restantes</span>
                <strong>{remainingBalloons}</strong>
              </div>
              <div className="play-stat-box">
                <span className="small-text">Saldo total</span>
                <strong>{formatCurrency(playData?.configuration?.total_value)}</strong>
              </div>
              <div className="play-stat-box">
                <span className="small-text">Distribuído</span>
                <strong>{formatCurrency(summary?.awarded_total)}</strong>
              </div>
            </div>

            <div className="play-stats-grid">
              <div className="play-stat-box compact">
                <span className="small-text">Balões estourados</span>
                <strong>{poppedBalloons}</strong>
              </div>
              <div className="play-stat-box compact">
                <span className="small-text">Saldo restante</span>
                <strong>{formatCurrency(summary?.remaining_total)}</strong>
              </div>
              <div className="play-stat-box compact">
                <span className="small-text">Registros pendentes</span>
                <strong>{summary?.pending_tokens ?? 0}</strong>
              </div>
            </div>

            <div className="play-history">
              <div className="play-sidebar-header">
                <h4>Últimos resultados</h4>
              </div>

              {recentUsed.length === 0 ? (
                <p className="tokens-empty play-history-empty">
                  Nenhum balão estourado ainda.
                </p>
              ) : (
                <div className="play-history-list">
                  {recentUsed.map((item, index) => (
                    <div key={`${item.id}-${item.code}`} className="play-history-item">
                      <div>
                        <strong>{`Balão ${recentUsed.length - index}`}</strong>
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
