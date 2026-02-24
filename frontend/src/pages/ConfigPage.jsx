import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getConfiguration,
  generateCodes,
  listCodes,
  saveConfiguration,
} from '../services/api'

const DEFAULT_DISTRIBUTION = [
  { min: 40, max: 49, weight: 32 },
  { min: 50, max: 59, weight: 22 },
  { min: 60, max: 69, weight: 13 },
  { min: 70, max: 79, weight: 20 },
  { min: 80, max: 89, weight: 7 },
  { min: 90, max: 99, weight: 4 },
  { min: 100, max: 110, weight: 2 },
]

const TAB_CONFIGURATION = 'configuration'
const TAB_TOKENS = 'tokens'
const TABS = [
  { id: TAB_CONFIGURATION, label: 'Configuração' },
  { id: TAB_TOKENS, label: 'Gerar tokens' },
]

function formatAmount(value) {
  if (!Number.isFinite(value)) return '0'
  return value % 1 === 0 ? `${value}` : value.toFixed(2)
}

function deriveBucketLabel(bucket) {
  const minValue = Number(bucket?.min ?? 0)
  const maxValue = Number(bucket?.max ?? minValue)
  const min = Number.isFinite(minValue) ? minValue : 0
  const max = Number.isFinite(maxValue) ? maxValue : min

  if (min >= 100) {
    return `R$${formatAmount(min)}+`
  }

  if (min === max) {
    return `R$${formatAmount(min)}`
  }

  return `R$${formatAmount(min)}-${formatAmount(max)}`
}

function formatCurrency(value) {
  if (value == null) {
    return '—'
  }
  const number = Number(value)
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(isFinite(number) ? number : 0)
}

function ConfigPage() {
  const [configuration, setConfiguration] = useState(null)
  const [quantity, setQuantity] = useState(50)
  const [totalValue, setTotalValue] = useState(700)
  const [distribution, setDistribution] = useState(DEFAULT_DISTRIBUTION)
  const [codes, setCodes] = useState([])
  const [statusMessage, setStatusMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
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

  const distributionWithDefaults = useMemo(
    () =>
      distribution.map((bucket) => ({
        ...bucket,
        weight: Math.min(50, Math.max(0, Number(bucket.weight ?? 0))),
        label: deriveBucketLabel(bucket),
      })),
    [distribution],
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

      if (aUsed !== bUsed) {
        return aUsed ? -1 : 1
      }

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

  async function fetchConfiguration() {
    try {
      const response = await getConfiguration()
      setConfiguration(response)
      setQuantity(response.total_balloons)
      setTotalValue(response.total_value)
      setDistribution(
        response.distribution?.length
          ? response.distribution
          : DEFAULT_DISTRIBUTION,
      )
    } catch (error) {
      setStatusMessage(error.message)
    }
  }

  async function fetchCodes() {
    try {
      const response = await listCodes()
      setCodes(response ?? [])
    } catch (error) {
      console.debug('Não foi possível obter códigos', error)
    }
  }

  async function handleSave() {
    if (!quantity || !totalValue) return
    if (Number(quantity) < 40) {
      setStatusMessage('A quantidade mínima é 40 balões')
      return
    }

    setSaving(true)
    setStatusMessage('')

    try {
      const payload = {
        total_balloons: Number(quantity),
        total_value: Number(totalValue),
        distribution: distributionWithDefaults,
      }
      const response = await saveConfiguration(payload)
      setConfiguration(response)
      setStatusMessage('Configuração salva')
    } catch (error) {
      setStatusMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerateTokens(quantityValue) {
    if (!configuration) {
      setStatusMessage('Salve a configuração antes de gerar códigos')
      return
    }

    setGenerating(true)
    setStatusMessage('')

    try {
      const payloadQuantity = Number(quantityValue)
      const { codes: generated, configuration: updated } = await generateCodes(
        payloadQuantity,
        configuration.id,
      )

      setCodes((prev) => [...(generated ?? []), ...prev])
      setConfiguration(updated ?? configuration)
      setStatusMessage('Tokens gerados')
    } catch (error) {
      setStatusMessage(error.message)
    } finally {
      setGenerating(false)
    }
  }

  function updateBucket(index, value) {
    setDistribution((current) =>
      current.map((bucket, idx) =>
        idx !== index
          ? bucket
          : { ...bucket, weight: Math.min(50, Math.max(0, Number(value))) },
      ),
    )
  }

  function copyCode(code) {
    navigator.clipboard.writeText(code).then(() => {
      setStatusMessage(`Código ${code} copiado`)
    })
  }

  function randomizeDistribution() {
    setDistribution((current) =>
      current.map((bucket) => ({
        ...bucket,
        weight: 1 + Math.floor(Math.random() * 50),
      })),
    )
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="label">Quantidade de balões</p>
          <input
            type="number"
            min="40"
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

      <div className="config-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab-button ${
              activeTab === tab.id ? 'active' : 'inactive'
            }`}
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
                  <span aria-hidden>↺</span>
                </button>
                <div className="distribution-grid">
                  {distributionWithDefaults.map((bucket, index) => (
                    <div
                      key={`${bucket.min}-${bucket.max}-${index}`}
                      className="distribution-card"
                    >
                      <p className="distribution-label">{bucket.label}</p>
                      <div className="slider-row">
                        <input
                          type="range"
                          min="0"
                          max="50"
                          value={bucket.weight}
                          onChange={(event) =>
                            updateBucket(index, event.target.value)
                          }
                        />
                        <span className="percentage">{bucket.weight}%</span>
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
                  Salvar Configuração
                </button>
              </div>

              {statusMessage && (
                <p className="status-message">{statusMessage}</p>
              )}
            </div>
            <div className="tab-footer">
              <Link
                to="/play"
                target="_blank"
                rel="noreferrer"
                className="ghost-button"
              >
                Ver funcionamento
              </Link>
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
                            ? Number(code.value) > 0 ? formatCurrency(code.value) : 'Sem prêmio'
                            : '—'}
                        </td>
                        <td className="table-status">
                          {code.status.charAt(0).toUpperCase() +
                            code.status.slice(1)}
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
    </section>
  )
}

export default ConfigPage
