import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getConfiguration,
  generateCodes,
  listCodes,
  resetCodes,
  saveConfiguration,
} from '../services/api'

const DEFAULT_DISTRIBUTION = [
  { min: 1, max: 20, weight: 24 },
  { min: 21, max: 40, weight: 34 },
  { min: 41, max: 60, weight: 50 },
  { min: 61, max: 80, weight: 33 },
  { min: 81, max: 100, weight: 13 },
]
const DEFAULT_PRANK_PERCENTAGE = 20
const MIN_PRANK_PERCENTAGE = 0
const MAX_PRANK_PERCENTAGE = 95

const TAB_CONFIGURATION = 'configuration'
const TAB_TOKENS = 'tokens'
const TABS = [
  { id: TAB_CONFIGURATION, label: 'Configuração' },
  { id: TAB_TOKENS, label: 'Gerar tokens' },
]
const MIN_BUCKET_WEIGHT = 1
const MAX_BUCKET_WEIGHT = 50

function getBucketKey(bucket) {
  return `${Number(bucket?.min ?? 0)}-${Number(bucket?.max ?? 0)}`
}

function mergeDistributionWithDefaults(source) {
  const input = Array.isArray(source) ? source : []
  const byKey = new Map(input.map((bucket) => [getBucketKey(bucket), bucket]))
  return DEFAULT_DISTRIBUTION.map((bucket) => ({
    ...bucket,
    ...(byKey.get(getBucketKey(bucket)) ?? {}),
  }))
}

function formatAmount(value) {
  if (!Number.isFinite(value)) return '0'
  return value % 1 === 0 ? `${value}` : value.toFixed(2)
}

function deriveBucketLabel(bucket, options = {}) {
  const isOpenEnded = Boolean(options?.isOpenEnded)
  const minValue = Number(bucket?.min ?? 0)
  const maxValue = Number(bucket?.max ?? minValue)
  const min = Number.isFinite(minValue) ? minValue : 0
  const max = Number.isFinite(maxValue) ? maxValue : min

  if (min === max) return `R$${formatAmount(min)}`
  if (isOpenEnded || min >= 100) return `R$${formatAmount(min)}+`
  return `R$${formatAmount(min)}-${formatAmount(max)}`
}

function formatCurrency(value) {
  if (value == null) return '-'

  const number = Number(value)
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(number) ? number : 0)
}

function translateStatus(status) {
  const normalized = String(status || '').toLowerCase()

  if (normalized === 'used') return 'Usado'
  if (normalized === 'pending') return 'Pendente'

  return status
}

function clampPrankPercentage(value) {
  const numeric = Math.round(Number(value ?? DEFAULT_PRANK_PERCENTAGE))
  if (!Number.isFinite(numeric)) return DEFAULT_PRANK_PERCENTAGE
  return Math.min(MAX_PRANK_PERCENTAGE, Math.max(MIN_PRANK_PERCENTAGE, numeric))
}

function getPrankBalloonCountFromPercentage(totalBalloons, prankPercentage) {
  const total = Math.max(0, Math.round(Number(totalBalloons) || 0))
  const percent = clampPrankPercentage(prankPercentage)
  const requested = Math.round((total * percent) / 100)
  const maxPranksKeepingMoney = Math.max(0, total - 1)

  return Math.min(maxPranksKeepingMoney, Math.max(0, requested))
}

function toDisplayPercentages(items) {
  const weights = items.map((bucket) =>
    Math.min(MAX_BUCKET_WEIGHT, Math.max(MIN_BUCKET_WEIGHT, Number(bucket.weight ?? MIN_BUCKET_WEIGHT))),
  )
  const total = weights.reduce((sum, weight) => sum + weight, 0)

  if (total <= 0) {
    return items.map(() => 0)
  }

  const parts = weights.map((weight, index) => {
    const exact = (weight / total) * 100
    const base = Math.floor(exact)
    return {
      index,
      base,
      fraction: exact - base,
    }
  })

  let remainder = 100 - parts.reduce((sum, part) => sum + part.base, 0)

  parts
    .slice()
    .sort((a, b) => b.fraction - a.fraction)
    .forEach((part) => {
      if (remainder <= 0) return
      part.base += 1
      remainder -= 1
    })

  return parts.sort((a, b) => a.index - b.index).map((part) => part.base)
}

function getDistinctPrizeValues(distribution) {
  const values = new Set()

  distribution.forEach((bucket) => {
    const weight = Number(bucket?.weight ?? 0)
    if (weight <= 0) return

    const min = Math.max(0, Math.round(Number(bucket?.min ?? 0)))
    const max = Math.max(min, Math.round(Number(bucket?.max ?? min)))

    for (let value = min; value <= max; value += 1) {
      if (value > 0) values.add(value)
    }
  })

  return [...values].sort((a, b) => a - b)
}

function ConfigPage() {
  const [configuration, setConfiguration] = useState(null)
  const [quantity, setQuantity] = useState(50)
  const [totalValue, setTotalValue] = useState(700)
  const [prankPercentage, setPrankPercentage] = useState(DEFAULT_PRANK_PERCENTAGE)
  const [distribution, setDistribution] = useState(() => mergeDistributionWithDefaults(DEFAULT_DISTRIBUTION))
  const [codes, setCodes] = useState([])
  const [toast, setToast] = useState(null)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [resettingTokens, setResettingTokens] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [tokenQuantity, setTokenQuantity] = useState(10)
  const [activeTab, setActiveTab] = useState(TAB_CONFIGURATION)

  useEffect(() => {
    fetchConfiguration()
  }, [])

  useEffect(() => {
    if (configuration) {
      fetchCodes()
    }
  }, [configuration])

  useEffect(() => {
    if (!configuration || activeTab !== TAB_TOKENS) return undefined

    fetchCodes()

    const intervalId = window.setInterval(() => {
      fetchCodes()
    }, 5000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [configuration, activeTab])

  useEffect(() => {
    if (!toast?.id) return undefined

    const timeoutId = window.setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current))
    }, 2800)

    return () => window.clearTimeout(timeoutId)
  }, [toast])

  const distributionWithDefaults = useMemo(
    () => {
      const normalized = mergeDistributionWithDefaults(distribution).map((bucket) => ({
        ...bucket,
        weight: Math.min(
          MAX_BUCKET_WEIGHT,
          Math.max(MIN_BUCKET_WEIGHT, Number(bucket.weight ?? MIN_BUCKET_WEIGHT)),
        ),
      }))
      const topBucketIndex = normalized.reduce((bestIndex, bucket, index, items) => {
        if (bestIndex < 0) return index

        const current = items[bestIndex]
        const bucketMax = Number(bucket?.max ?? bucket?.min ?? 0)
        const currentMax = Number(current?.max ?? current?.min ?? 0)
        if (bucketMax > currentMax) return index

        const bucketMin = Number(bucket?.min ?? 0)
        const currentMin = Number(current?.min ?? 0)
        if (bucketMax === currentMax && bucketMin >= currentMin) return index

        return bestIndex
      }, -1)

      const displayPercentages = toDisplayPercentages(normalized)

      return normalized.map((bucket, index) => ({
        ...bucket,
        displayPercent: displayPercentages[index] ?? 0,
        label: deriveBucketLabel(bucket, { isOpenEnded: index === topBucketIndex }),
      }))
    },
    [distribution],
  )
  const distributionTotal = useMemo(
    () =>
      distributionWithDefaults.reduce(
        (sum, bucket) => sum + Number(bucket.displayPercent || 0),
        0,
      ),
    [distributionWithDefaults],
  )

  const sortedCodes = useMemo(() => {
    const toTimestamp = (value) => {
      if (!value) return 0
      const time = new Date(value).getTime()
      return Number.isFinite(time) ? time : 0
    }

    return [...codes].sort((a, b) => {
      const aUsed = a.status === 'used'
      const bUsed = b.status === 'used'

      if (aUsed !== bUsed) return aUsed ? -1 : 1

      if (aUsed && bUsed) {
        const usedDiff =
          toTimestamp(b.used_at ?? b.updated_at) -
          toTimestamp(a.used_at ?? a.updated_at)
        if (usedDiff !== 0) return usedDiff
      }

      const createdDiff =
        toTimestamp(b.created_at ?? b.updated_at) -
        toTimestamp(a.created_at ?? a.updated_at)
      if (createdDiff !== 0) return createdDiff

      return Number(b.id ?? 0) - Number(a.id ?? 0)
    })
  }, [codes])

  const quantityNumber = Math.max(0, Number(quantity) || 0)
  const totalValueNumber = Math.max(0, Number(totalValue) || 0)
  const prankPercentageNumber = clampPrankPercentage(prankPercentage)
  const prankBalloonCount = getPrankBalloonCountFromPercentage(
    quantityNumber,
    prankPercentageNumber,
  )
  const moneyBalloonCount = Math.max(0, quantityNumber - prankBalloonCount)
  const prankChancePercent = prankPercentageNumber
  const moneyChancePercent = Math.max(0, 100 - prankPercentageNumber)
  const effectivePrankChancePercent =
    quantityNumber > 0 ? Math.round((prankBalloonCount / quantityNumber) * 100) : 0
  const averagePerBalloon =
    quantityNumber > 0 ? Math.floor(totalValueNumber / quantityNumber) : 0
  const distinctPrizeValues = useMemo(
    () => getDistinctPrizeValues(distributionWithDefaults),
    [distributionWithDefaults],
  )
  const availableUniquePrizeCount = distinctPrizeValues.length
  const minimumNoZeroTotal = useMemo(
    () =>
      distinctPrizeValues
        .slice(0, Math.max(0, moneyBalloonCount))
        .reduce((sum, value) => sum + value, 0),
    [distinctPrizeValues, moneyBalloonCount],
  )
  const hasEnoughUniquePrizes = availableUniquePrizeCount >= moneyBalloonCount
  const hasNoZeroConfigIssue =
    !hasEnoughUniquePrizes ||
    totalValueNumber < minimumNoZeroTotal
  const noZeroWarningText = !hasEnoughUniquePrizes
    ? `Faixas insuficientes: apenas ${availableUniquePrizeCount} valores únicos para ${moneyBalloonCount} balões de dinheiro sem repetir.`
    : totalValueNumber < minimumNoZeroTotal
      ? `Total insuficiente para evitar zerados. Mínimo necessário: ${formatCurrency(minimumNoZeroTotal)}.`
      : ''

  function showToast(message, type = 'info') {
    if (!message) return

    setToast({
      id: Date.now() + Math.random(),
      message,
      type,
    })
  }

  function clearToast() {
    setToast(null)
  }

  async function fetchConfiguration() {
    try {
      const response = await getConfiguration()
      setConfiguration(response)
      setQuantity(response.total_balloons)
      setTotalValue(response.total_value)
      setPrankPercentage(
        response.prank_percentage ?? response.prank_chance_percent ?? DEFAULT_PRANK_PERCENTAGE,
      )
      setDistribution(mergeDistributionWithDefaults(response.distribution))
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  async function fetchCodes() {
    if (!configuration?.id) return

    try {
      const response = await listCodes(configuration.id)
      setCodes(response ?? [])
    } catch (error) {
      console.debug('Não foi possível obter códigos', error)
    }
  }

  async function handleSave() {
    if (!quantity || totalValue === '') return

    if (Number(quantity) < 10) {
      showToast('A quantidade mínima é 10 balões', 'error')
      return
    }

    if (!hasEnoughUniquePrizes) {
      showToast(
        `Configuração impossível: existem apenas ${availableUniquePrizeCount} valores únicos disponíveis para ${moneyBalloonCount} balões de dinheiro sem repetir.`,
        'error',
      )
      return
    }

    if (totalValueNumber < minimumNoZeroTotal) {
      showToast(
        `Para não zerar nenhum balão de dinheiro, o total mínimo é ${formatCurrency(minimumNoZeroTotal)}.`,
        'error',
      )
      return
    }

    setSaving(true)
    clearToast()

    try {
      const payload = {
        total_balloons: Number(quantity),
        total_value: Number(totalValue),
        prank_percentage: prankPercentageNumber,
        distribution: distributionWithDefaults,
      }
      const response = await saveConfiguration(payload)
      setConfiguration(response)
      setPrankPercentage(response?.prank_percentage ?? prankPercentageNumber)
      showToast('Configuração salva', 'success')
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerateTokens(quantityValue) {
    if (!configuration) {
      showToast('Salve a configuração antes de gerar códigos', 'error')
      return
    }

    setGenerating(true)
    clearToast()

    try {
      const payloadQuantity = Number(quantityValue)
      const { codes: generated, configuration: updated } = await generateCodes(
        payloadQuantity,
        configuration.id,
      )

      setCodes((prev) => [...(generated ?? []), ...prev])
      setConfiguration(updated ?? configuration)
      showToast('Tokens gerados', 'success')
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setGenerating(false)
    }
  }

  function askResetTokens() {
    if (!configuration) {
      showToast('Salve a configuração antes de gerenciar tokens', 'error')
      return
    }

    if (!tokenQuantity || Number(tokenQuantity) < 1) {
      showToast('Informe a quantidade de tokens para gerar no reset', 'error')
      return
    }

    setShowResetModal(true)
  }

  async function confirmResetTokens() {
    if (!configuration) return

    setResettingTokens(true)
    clearToast()

    try {
      const response = await resetCodes(configuration.id, Number(tokenQuantity))
      setCodes(response.codes ?? [])
      showToast(
        `${response.deleted_count ?? 0} token(s) apagado(s) e ${response.generated_count ?? 0} novo(s) gerado(s)`,
        'success',
      )
      setShowResetModal(false)
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setResettingTokens(false)
    }
  }

  function cancelResetTokens() {
    if (resettingTokens) return
    setShowResetModal(false)
  }

  function updateBucket(index, value) {
    setDistribution((current) =>
      current.map((bucket, idx) =>
        idx === index
          ? {
              ...bucket,
              weight: Math.min(
                MAX_BUCKET_WEIGHT,
                Math.max(MIN_BUCKET_WEIGHT, Number(value)),
              ),
            }
          : bucket,
      ),
    )
  }

  function copyCode(code) {
    navigator.clipboard.writeText(code).then(() => {
      showToast(`Código ${code} copiado`, 'info')
    })
  }

  function randomizeDistribution() {
    setPrankPercentage(
      MIN_PRANK_PERCENTAGE +
        Math.floor(Math.random() * (MAX_PRANK_PERCENTAGE - MIN_PRANK_PERCENTAGE + 1)),
    )

    setDistribution((current) =>
      current.map((bucket) => ({
        ...bucket,
        weight:
          MIN_BUCKET_WEIGHT +
          Math.floor(Math.random() * (MAX_BUCKET_WEIGHT - MIN_BUCKET_WEIGHT + 1)),
      })),
    )
  }

  return (
    <section className="panel">
      {toast && (
        <div className="toast-container" aria-live="polite">
          <div className={`toast-notify toast-${toast.type}`}>
            <span>{toast.message}</span>
            <button
              type="button"
              className="toast-close"
              onClick={clearToast}
              aria-label="Fechar notificação"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="panel-header">
        <div>
          <p className="label">Quantidade de balões</p>
          <input
            type="number"
            min="10"
            className="input-field"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </div>

        <div>
          <p className="label">Total em prêmios (R$)</p>
          <input
            type="number"
            min="0"
            step="1"
            className="input-field"
            value={totalValue}
            onChange={(event) => setTotalValue(event.target.value)}
          />
        </div>
      </div>

      <div
        className={`config-summary-bar${hasNoZeroConfigIssue ? ' config-summary-bar-warning' : ''}`}
        aria-label="Resumo da configuração"
      >
        <div className="config-summary-item">
          <span className="small-text">Média por balão:</span>
          <strong>{formatCurrency(averagePerBalloon)}</strong>
        </div>
        <div className="config-summary-item">
          <span className="small-text">Distribuição dinheiro:</span>
          <strong>{distributionTotal}%</strong>
        </div>
        <div className="config-summary-item">
          <span className="small-text">Mínimo sem zerar:</span>
          <strong>{formatCurrency(minimumNoZeroTotal)}</strong>
        </div>
        <div className="config-summary-item">
          <span className="small-text">Total:</span>
          <strong>{formatCurrency(totalValueNumber)}</strong>
        </div>
        {hasNoZeroConfigIssue && (
          <p className="config-summary-warning-text">{noZeroWarningText}</p>
        )}
      </div>

      <div className="config-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab-button ${activeTab === tab.id ? 'active' : 'inactive'}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="panel-tab-content">
        {activeTab === TAB_CONFIGURATION ? (
          <>
            <div className="panel-body">
              <div className="distribution-wrapper">
                <button
                  type="button"
                  className="randomize-button"
                  title="Aleatorizar distribuição"
                  onClick={randomizeDistribution}
                >
                  <span aria-hidden>&#8635;</span>
                </button>

                <div className="distribution-grid">
                  <div className="distribution-card prank-distribution-card">
                    <p className="distribution-label">Chance de pegadinha</p>
                    <div className="slider-row">
                      <input
                        type="range"
                        min={MIN_PRANK_PERCENTAGE}
                        max={MAX_PRANK_PERCENTAGE}
                        value={prankPercentageNumber}
                        onChange={(event) => setPrankPercentage(event.target.value)}
                      />
                      <span className="percentage">{prankPercentageNumber}%</span>
                    </div>
                    <p className="distribution-helper">
                      Equivale a {prankBalloonCount} balões de pegadinha e {moneyBalloonCount} de dinheiro
                    </p>
                    <div className="play-chances-wrap" aria-label="Chance de pegadinhas e dinheiro">
                      <div className="play-chances-labels">
                        <span>Pegadinhas: {prankChancePercent}%</span>
                        <span>Dinheiro: {moneyChancePercent}%</span>
                      </div>
                      <div
                        className="play-chances-track"
                        role="img"
                        aria-label={`Chance de pegadinhas ${prankChancePercent} por cento e chance de dinheiro ${moneyChancePercent} por cento`}
                      >
                        <div
                          className="play-chances-fill prank"
                          style={{ width: `${prankChancePercent}%` }}
                        />
                        <div
                          className="play-chances-fill money"
                          style={{ width: `${moneyChancePercent}%` }}
                        />
                      </div>
                    </div>
                    {effectivePrankChancePercent !== prankChancePercent && (
                      <p className="distribution-helper">
                        Percentual efetivo na rodada atual: {effectivePrankChancePercent}% (arredondamento por quantidade de balões)
                      </p>
                    )}
                  </div>

                  {distributionWithDefaults.map((bucket, index) => (
                    <div
                      key={`${bucket.min}-${bucket.max}-${index}`}
                      className="distribution-card"
                    >
                      <p className="distribution-label">{bucket.label}</p>
                      <div className="slider-row">
                        <input
                          type="range"
                          min={MIN_BUCKET_WEIGHT}
                          max={MAX_BUCKET_WEIGHT}
                          value={bucket.weight}
                          onChange={(event) =>
                            updateBucket(index, event.target.value)
                          }
                        />
                        <span className="percentage">{bucket.displayPercent}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="action-row">
                <button
                  className="ghost-button"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Salvando...' : 'Salvar configuração'}
                </button>

                <Link
                  to="/sorteios"
                  target="_blank"
                  rel="noreferrer"
                  className="ghost-button"
                >
                  Começar Sorteios
                </Link>
              </div>
            </div>
          </>
        ) : (
          <div className="tokens-table-wrapper">
            <div className="token-generation">
              <label htmlFor="tokenQuantity">Quantidade de tokens</label>
              <input
                id="tokenQuantity"
                type="number"
                min="1"
                className="input-field small"
                value={tokenQuantity}
                onChange={(event) => setTokenQuantity(event.target.value)}
              />

              <button
                className="primary-button"
                onClick={() => handleGenerateTokens(tokenQuantity)}
                disabled={generating}
              >
                {generating ? 'Gerando...' : 'Gerar tokens'}
              </button>

              <button
                className="ghost-button"
                onClick={askResetTokens}
                disabled={resettingTokens}
              >
                {resettingTokens ? 'Resetando...' : 'Resetar tokens'}
              </button>
            </div>

            <p className="tokens-note">
              Os valores só aparecem depois que os códigos forem usados na página
              de Funcionamento.
            </p>

            {sortedCodes.length === 0 ? (
              <p className="tokens-empty">
                Nenhum token gerado ainda. Use o botão acima para criar códigos.
              </p>
            ) : (
              <div className="tokens-table-scroll">
                <table className="tokens-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Código</th>
                      <th>Valor</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCodes.map((code, index) => (
                      <tr key={code.code}>
                        <td>{index + 1}</td>
                        <td>
                          <strong>{code.code}</strong>
                        </td>
                        <td>
                          {code.status === 'used'
                            ? Number(code.value) > 0
                              ? formatCurrency(code.value)
                              : 'Sem prêmio'
                            : '-'}
                        </td>
                        <td className="table-status">
                          {translateStatus(code.status)}
                        </td>
                        <td>
                          <button
                            className="ghost-button small"
                            onClick={() => copyCode(code.code)}
                          >
                            Copiar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {showResetModal && (
        <div className="modal-overlay" onClick={cancelResetTokens}>
          <div
            className="result-card confirm-card"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="modal-flag">Confirmar</p>
            <p className="confirm-text">
              Isso vai apagar os tokens atuais e gerar novos códigos com a
              quantidade digitada ({Number(tokenQuantity) || 0}). Deseja
              continuar?
            </p>
            <div className="confirm-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={cancelResetTokens}
                disabled={resettingTokens}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={confirmResetTokens}
                disabled={resettingTokens}
              >
                {resettingTokens ? 'Resetando...' : 'Sim, resetar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default ConfigPage
