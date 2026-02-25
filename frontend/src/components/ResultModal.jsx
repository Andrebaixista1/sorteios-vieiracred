function formatCurrency(value) {
  const numericValue = Number(value || 0)
  return numericValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

function ResultModal({ value = null, results = null, totalValue = null, onClose }) {
  const hasFinalResults = Array.isArray(results) && results.length > 0

  if (!hasFinalResults && value === null) {
    return null
  }

  if (hasFinalResults) {
    const normalizedResults = results.map((item) => Number(item || 0))
    const computedTotal = normalizedResults.reduce((sum, item) => sum + item, 0)
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
          <span className="modal-subtitle">
            Valores de todos os balões desta rodada
          </span>

          <div className="final-results-table-wrap">
            <table className="final-results-table">
              <thead>
                <tr>
                  <th>Balão</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {normalizedResults.map((item, index) => (
                  <tr key={`${index}-${item}`}>
                    <td>{index + 1}</td>
                    <td>{formatCurrency(item)}</td>
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

  const numericValue = Number(value)
  const hasPrize = Number.isFinite(numericValue) && numericValue > 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="result-card" onClick={(event) => event.stopPropagation()}>
        <p className="modal-flag">{hasPrize ? 'Parabéns!' : 'Sem prêmio'}</p>
        <p className="modal-value">{hasPrize ? formatCurrency(numericValue) : 'R$ 0'}</p>
        <span className="modal-subtitle">
          {hasPrize ? 'Toque para fechar' : 'Toque para continuar'}
        </span>
      </div>
    </div>
  )
}

export default ResultModal
