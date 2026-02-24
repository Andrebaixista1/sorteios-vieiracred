function ResultModal({ value, onClose }) {
  if (value === null) {
    return null
  }

  const numericValue = Number(value)
  const hasPrize = Number.isFinite(numericValue) && numericValue > 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="result-card" onClick={(event) => event.stopPropagation()}>
        <p className="modal-flag">{hasPrize ? 'Parabéns!' : 'Sem prêmio'}</p>
        <p className="modal-value">
          {hasPrize
            ? numericValue.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })
            : 'R$ 0'}
        </p>
        <span className="modal-subtitle">
          {hasPrize ? 'Toque para fechar' : 'Tente novamente com outro token'}
        </span>
      </div>
    </div>
  )
}

export default ResultModal
