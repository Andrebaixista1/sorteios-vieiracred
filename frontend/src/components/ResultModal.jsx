function ResultModal({ value, onClose }) {
  if (value === null) {
    return null
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="result-card" onClick={(event) => event.stopPropagation()}>
        <p className="modal-flag">Parabéns!</p>
        <p className="modal-value">
          {Number(value).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })}
        </p>
        <span className="modal-subtitle">Toque para fechar</span>
      </div>
    </div>
  )
}

export default ResultModal
