import abracoImage from '../assets/abraco.png'
import angelaImage from '../assets/angela.png'
import apertoMaoImage from '../assets/aperto-mao.png'
import elogioImage from '../assets/elogio.png'
import ficaDeBoaImage from '../assets/ficadeboa.png'
import galvaoImage from '../assets/galvao.png'
import gerenteImage from '../assets/gerente.png'
import wesleyImage from '../assets/wesley.png'

function getPrankKey(label) {
  return String(label ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function prankKeyHasAll(key, parts) {
  return parts.every((part) => key.includes(part))
}

function normalizePrankLabelText(label) {
  const key = getPrankKey(label)

  if (prankKeyHasAll(key, ['cookie', 'angela']) || prankKeyHasAll(key, ['mural', 'campeo'])) {
    return 'Vale um cookie pago pela Angela'
  }

  if (prankKeyHasAll(key, ['dancinha']) || prankKeyHasAll(key, ['danca', 'vitoria'])) {
    return 'Vai ter que fazer uma dancinha (30s)'
  }

  if (prankKeyHasAll(key, ['fica', 'boas', 'dessa', 'vez']) || prankKeyHasAll(key, ['selfie', 'time'])) {
    return 'Fica de boas não foi dessa vez'
  }

  if (prankKeyHasAll(key, ['elogio', 'voz', 'alta'])) {
    return 'Vale elogio em voz alta'
  }

  if (prankKeyHasAll(key, ['aperto', 'premium'])) {
    return 'Ganhe um aperto de mão premium'
  }

  if (prankKeyHasAll(key, ['abr', 'gerente'])) {
    return 'Ganhe um abraço do gerente'
  }

  if (prankKeyHasAll(key, ['abr', 'wesley']) || prankKeyHasAll(key, ['abr', 'ceo'])) {
    return 'Ganhe um abraço do Wesley'
  }

  if (prankKeyHasAll(key, ['ganhe', 'abr'])) {
    return 'Ganhe um abraço'
  }

  return String(label ?? '')
}

function formatCurrency(value) {
  const numericValue = Number(value || 0)
  return numericValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

function normalizeOutcome(item) {
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    const numericValue = Number(item.value ?? 0)
    return {
      type: item.type === 'prank' ? 'prank' : 'money',
      value: Number.isFinite(numericValue) ? numericValue : 0,
      prankLabel: normalizePrankLabelText(item.prankLabel ?? item.prank_label ?? null),
    }
  }

  const numericValue = Number(item ?? 0)
  return {
    type: 'money',
    value: Number.isFinite(numericValue) ? numericValue : 0,
    prankLabel: null,
  }
}

function getPrankPresentation(label) {
  const normalizedLabel = normalizePrankLabelText(label)
  const prankKey = getPrankKey(normalizedLabel)

  if (prankKey === 'vale um cookie pago pela angela') {
    return {
      label: 'Vale um cookie pago pela Angela',
      image: angelaImage,
    }
  }

  if (prankKey === 'vai ter que fazer uma dancinha 30s') {
    return {
      label: 'Vai ter que fazer uma dancinha (30s)',
      image: galvaoImage,
    }
  }

  if (prankKey === 'fica de boas nao foi dessa vez') {
    return {
      label: 'Fica de boas não foi dessa vez',
      image: ficaDeBoaImage,
    }
  }

  if (prankKey === 'ganhe um abraco') {
    return {
      label: 'Ganhe um abraço',
      image: abracoImage,
    }
  }

  if (prankKey === 'ganhe um abraco do gerente') {
    return {
      label: 'Ganhe um abraço do gerente',
      image: gerenteImage,
    }
  }

  if (prankKey === 'vale elogio em voz alta') {
    return {
      label: 'Vale elogio em voz alta',
      image: elogioImage,
    }
  }

  if (prankKey === 'ganhe um aperto de mao premium') {
    return {
      label: 'Ganhe um aperto de mão premium',
      image: apertoMaoImage,
    }
  }

  if (prankKey === 'ganhe um abraco do wesley') {
    return {
      label: 'Ganhe um abraço do Wesley',
      image: wesleyImage,
    }
  }

  return {
    label: normalizedLabel || 'Pegadinha surpresa',
    image: null,
  }
}

function ResultModal({ value = null, results = null, totalValue = null, onClose }) {
  const hasFinalResults = Array.isArray(results) && results.length > 0

  if (!hasFinalResults && value === null) {
    return null
  }

  if (hasFinalResults) {
    const normalizedResults = results.map((item) => normalizeOutcome(item))
    const computedTotal = normalizedResults.reduce(
      (sum, item) => sum + (item.type === 'money' ? Number(item.value || 0) : 0),
      0,
    )
    const finalTotal = Number.isFinite(Number(totalValue))
      ? Number(totalValue)
      : computedTotal

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="result-card final-results-card"
          onClick={(event) => event.stopPropagation()}
        >
          <p className="modal-flag">Resultado Final</p>
          <p className="modal-value">{formatCurrency(finalTotal)}</p>
          <span className="modal-subtitle">Resultados de todos os balões desta rodada</span>

          <div className="final-results-table-wrap">
            <table className="final-results-table">
              <thead>
                <tr>
                  <th>Balão</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {normalizedResults.map((item, index) => (
                  <tr key={`${index}-${item.type}-${item.value}`}>
                    <td>{index + 1}</td>
                    <td>
                      {item.type === 'prank'
                        ? `Pegadinha: ${normalizePrankLabelText(item.prankLabel) || 'Surpresa'}`
                        : formatCurrency(item.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button type="button" className="primary-button" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    )
  }

  const outcome = normalizeOutcome(value)
  const numericValue = Number(outcome.value)
  const isPrank = outcome.type === 'prank'
  const hasPrize = outcome.type === 'money' && Number.isFinite(numericValue) && numericValue > 0
  const prankPresentation = isPrank ? getPrankPresentation(outcome.prankLabel) : null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="result-card" onClick={(event) => event.stopPropagation()}>
        <p className="modal-flag">
          {isPrank ? 'Pegadinha!' : hasPrize ? 'Parabéns!' : 'Sem prêmio'}
        </p>
        {isPrank && prankPresentation?.image && (
          <img
            src={prankPresentation.image}
            alt={prankPresentation.label}
            className="modal-prank-image"
          />
        )}
        <p className={`modal-value${isPrank ? ' modal-prank-text' : ''}`}>
          {isPrank
            ? prankPresentation?.label ?? 'Pegadinha surpresa'
            : hasPrize
              ? formatCurrency(numericValue)
              : 'R$ 0'}
        </p>
        <span className="modal-subtitle">
          {isPrank ? 'Toque para continuar' : hasPrize ? 'Toque para fechar' : 'Toque para continuar'}
        </span>
      </div>
    </div>
  )
}

export default ResultModal
