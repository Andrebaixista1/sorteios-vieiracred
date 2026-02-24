const defaultColors = [
  '#2bd8a1',
  '#1b99ff',
  '#fff04a',
  '#ff6767',
  '#6b5cff',
]

function BalloonGrid({
  rows = 5,
  columns = 7,
  colors = defaultColors,
  onPop,
  disabled = false,
}) {
  const total = rows * columns

  return (
    <div className="balloon-grid">
      {Array.from({ length: total }).map((_, index) => {
        const color = colors[index % colors.length]
        const handleClick = () => {
          if (disabled) return
          onPop?.(index)
        }

        return (
          <div
            key={`${index}-${color}`}
            className={`balloon${disabled ? ' balloon-disabled' : ''}`}
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
              background: `radial-gradient(circle at 35% 25%, #ffffff60, ${color})`,
              animationDelay: `${(index % columns) * 0.05}s`,
            }}
          />
        )
      })}
    </div>
  )
}

export default BalloonGrid
