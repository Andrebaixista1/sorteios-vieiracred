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
      prankLabel: item.prankLabel ?? item.prank_label ?? null,
    }
  }

  const numericValue = Number(item ?? 0)
  return {
    type: 'money',
    value: Number.isFinite(numericValue) ? numericValue : 0,
    prankLabel: null,
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
          <span className="modal-subtitle">Resultados de todos os baloes desta rodada</span>

          <div className="final-results-table-wrap">
            <table className="final-results-table">
              <thead>
                <tr>
                  <th>Balao</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {normalizedResults.map((item, index) => (
                  <tr key={`${index}-${item.type}-${item.value}`}>
                    <td>{index + 1}</td>
                    <td>
                      {item.type === 'prank'
                        ? `Pegadinha: ${item.prankLabel ?? 'Surpresa'}`
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="result-card" onClick={(event) => event.stopPropagation()}>
        <p className="modal-flag">
          {isPrank ? 'Pegadinha!' : hasPrize ? 'Parabens!' : 'Sem premio'}
        </p>
        <p className={`modal-value${isPrank ? ' modal-prank-text' : ''}`}>
          {isPrank
            ? outcome.prankLabel ?? 'Pegadinha surpresa'
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
