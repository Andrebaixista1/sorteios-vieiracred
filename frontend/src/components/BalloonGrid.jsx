const defaultColors = [
  '#2bd8a1',
  '#1b99ff',
  '#fff04a',
  '#ff6767',
  '#6b5cff',
]

function BalloonGrid({
  total,
  slotsTotal,
  rows = 5,
  columns = 7,
  colors = defaultColors,
  onPop,
  disabled = false,
  burstIndex = null,
}) {
  const balloonTotal =
    Number.isFinite(Number(total)) && Number(total) > 0
      ? Number(total)
      : rows * columns
  const totalSlots =
    Number.isFinite(Number(slotsTotal)) && Number(slotsTotal) > 0
      ? Number(slotsTotal)
      : balloonTotal

  return (
    <div
      className="balloon-grid"
      style={{
        '--balloon-grid-columns': columns,
      }}
    >
      {Array.from({ length: totalSlots }).map((_, index) => {
        if (index >= balloonTotal) {
          return (
            <div
              key={`empty-${index}`}
              className="balloon-slot balloon-slot-empty"
              aria-hidden="true"
            />
          )
        }

        const color = colors[index % colors.length]
        const tilt = ((index % 5) - 2) * 2
        const handleClick = () => {
          if (disabled) return
          onPop?.(index)
        }

        return (
          <div
            key={`${index}-${color}`}
            className={`balloon${disabled ? ' balloon-disabled' : ''}${
              burstIndex === index ? ' balloon-popping' : ''
            }`}
            role="button"
            tabIndex={disabled ? -1 : 0}
            onClick={handleClick}
            onKeyDown={(event) => {
              if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault()
                handleClick()
              }
            }}
            style={{
              '--balloon-color': color,
              '--balloon-tilt': `${tilt}deg`,
              '--balloon-delay': `${(index % columns) * 0.05}s`,
              '--balloon-float-duration': `${3.6 + (index % 4) * 0.35}s`,
            }}
          >
            {burstIndex === index && (
              <div className="balloon-confetti" aria-hidden="true">
                {Array.from({ length: 14 }).map((__, confettiIndex) => (
                  <span
                    key={confettiIndex}
                    className="confetti-piece"
                    style={{
                      '--confetti-angle': `${(360 / 14) * confettiIndex}deg`,
                      '--confetti-delay': `${(confettiIndex % 4) * 0.015}s`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default BalloonGrid
