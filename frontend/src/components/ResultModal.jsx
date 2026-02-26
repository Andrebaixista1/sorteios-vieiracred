import abracoImage from '../assets/abraco.png'
import angelaImage from '../assets/angela.png'
import apertoMaoImage from '../assets/aperto-mao.png'
import dancaGatinhoImage from '../assets/dancaGatinho.png'
import doceHugoImage from '../assets/doceHugo.png'
import doceJeniImage from '../assets/doceJeni.png'
import doceRyanImage from '../assets/doceRyan.png'
import elogioImage from '../assets/elogio.png'
import ficaDeBoaImage from '../assets/ficadeboa.png'
import galvaoImage from '../assets/galvao.png'
import gerenteImage from '../assets/gerente.png'
import leticiaBrasilImage from '../assets/leticiaBrasil.png'
import valePix10Image from '../assets/valePix.png'
import valePix5Image from '../assets/valePix5.png'
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

  if (prankKeyHasAll(key, ['doce', 'hugo'])) return 'Ganhe um doce do Hugo'
  if (prankKeyHasAll(key, ['doce', 'ryan'])) return 'Ganhe um doce do Ryan'
  if (prankKeyHasAll(key, ['doce', 'jheni']) || prankKeyHasAll(key, ['doce', 'jeni'])) return 'Ganhe um doce da Jheni'

  if (prankKeyHasAll(key, ['pix', '10']) && prankKeyHasAll(key, ['sem', 'nada'])) {
    return 'Vale PIX $10 (sem nada você não fica)'
  }

  if (prankKeyHasAll(key, ['pix', '5']) && prankKeyHasAll(key, ['jeeh'])) {
    return 'Ganhe PIX $5 (da Jeeh Rainha)'
  }

  if (prankKeyHasAll(key, ['danca', 'gatinho'])) return 'Dança gatinho (30s)'

  if (prankKeyHasAll(key, ['fica', 'boas', 'dessa', 'vez']) || prankKeyHasAll(key, ['selfie', 'time'])) {
    return 'Fica de boas não foi dessa vez'
  }

  if (prankKeyHasAll(key, ['foi', 'dessa', 'vez'])) return 'Não foi dessa vez'

  if (prankKeyHasAll(key, ['ganhe', 'cookie', 'angela'])) {
    return 'Ganhe um cookie da Angela'
  }

  if (prankKeyHasAll(key, ['cookie', 'angela']) || prankKeyHasAll(key, ['mural', 'campeo'])) {
    return 'Vale um cookie pago pela Angela'
  }

  if (prankKeyHasAll(key, ['dancinha']) || prankKeyHasAll(key, ['danca', 'vitoria'])) {
    return 'Vai ter que fazer uma dancinha (30s)'
  }

  if (prankKeyHasAll(key, ['elogio', 'voz', 'alta'])) return 'Vale elogio em voz alta'
  if (prankKeyHasAll(key, ['aperto', 'premium'])) return 'Ganhe um aperto de mão premium'
  if (prankKeyHasAll(key, ['abr', 'gerente'])) return 'Ganhe um abraço do gerente'
  if (prankKeyHasAll(key, ['abr', 'wesley']) || prankKeyHasAll(key, ['abr', 'ceo'])) return 'Ganhe um abraço do Wesley'
  if (prankKeyHasAll(key, ['ganhe', 'abr'])) return 'Ganhe um abraço'

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

  const imageMap = {
    'ganhe um doce do hugo': { label: 'Ganhe um doce do Hugo', image: doceHugoImage },
    'ganhe um doce do ryan': { label: 'Ganhe um doce do Ryan', image: doceRyanImage },
    'ganhe um doce da jheni': { label: 'Ganhe um doce da Jheni', image: doceJeniImage },
    'nao foi dessa vez': { label: 'Não foi dessa vez', image: leticiaBrasilImage },
    'danca gatinho 30s': { label: 'Dança gatinho (30s)', image: dancaGatinhoImage },
    'vale pix 10 sem nada voce nao fica': {
      label: 'Vale PIX $10 (sem nada você não fica)',
      image: valePix10Image,
    },
    'ganhe pix 5 da jeeh rainha': {
      label: 'Ganhe PIX $5 (da Jeeh Rainha)',
      image: valePix5Image,
    },
    'ganhe um cookie da angela': { label: 'Ganhe um cookie da Angela', image: angelaImage },
    'vale um cookie pago pela angela': { label: 'Vale um cookie pago pela Angela', image: angelaImage },
    'vai ter que fazer uma dancinha 30s': { label: 'Vai ter que fazer uma dancinha (30s)', image: galvaoImage },
    'fica de boas nao foi dessa vez': { label: 'Fica de boas não foi dessa vez', image: ficaDeBoaImage },
    'ganhe um abraco': { label: 'Ganhe um abraço', image: abracoImage },
    'ganhe um abraco do gerente': { label: 'Ganhe um abraço do gerente', image: gerenteImage },
    'vale elogio em voz alta': { label: 'Vale elogio em voz alta', image: elogioImage },
    'ganhe um aperto de mao premium': { label: 'Ganhe um aperto de mão premium', image: apertoMaoImage },
    'ganhe um abraco do wesley': { label: 'Ganhe um abraço do Wesley', image: wesleyImage },
  }

  return imageMap[prankKey] ?? { label: normalizedLabel || 'Pegadinha surpresa', image: null }
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
    const finalTotal = Number.isFinite(Number(totalValue)) ? Number(totalValue) : computedTotal

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="result-card final-results-card" onClick={(event) => event.stopPropagation()}>
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
        <p className="modal-flag">{isPrank ? 'Pegadinha!' : hasPrize ? 'Parabéns!' : 'Sem prêmio'}</p>
        {isPrank && prankPresentation?.image && (
          <img src={prankPresentation.image} alt={prankPresentation.label} className="modal-prank-image" />
        )}
        <p className={`modal-value${isPrank ? ' modal-prank-text' : ''}`}>
          {isPrank ? prankPresentation?.label ?? 'Pegadinha surpresa' : hasPrize ? formatCurrency(numericValue) : 'R$ 0'}
        </p>
        <span className="modal-subtitle">
          {isPrank ? 'Toque para continuar' : hasPrize ? 'Toque para fechar' : 'Toque para continuar'}
        </span>
      </div>
    </div>
  )
}

export default ResultModal
