/**
 * RadarChart.jsx — Gráfico radar SVG puro, sin dependencias externas.
 * Replica el estilo del gráfico de ejemplo.
 */
import { useMemo } from 'react'

const PILLAR_COLORS = {
  'Gestión y Gobierno del Dato': '#2563eb',
  'Consumo de Información':       '#d97706',
  'Analítica Avanzada':           '#7c3aed',
  'Estrategia del Dato':          '#dc2626',
}
const DEFAULT_COLOR = '#6b8c74'

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

export default function RadarChart({ dimensions, size = 520, lang = 'es' }) {
  const cx = size / 2
  const cy = size / 2
  const maxR = size * 0.36
  const labelR = size * 0.48
  const levels = [1, 2, 3, 4, 5]
  const maxScore = 5

  const dims = useMemo(() => {
    const entries = Object.entries(dimensions).filter(([, v]) => v.score !== null)
    return entries.map(([name, v], i) => ({
      name,
      nameEn: v.label_en || name,
      score: v.score,
      pilar: v.pilar,
      angle: (360 / entries.length) * i,
    }))
  }, [dimensions])

  const n = dims.length
  if (n < 3) return null

  // Polígono de datos
  const polygon = dims.map(d => {
    const r = (d.score / maxScore) * maxR
    return polarToCartesian(cx, cy, r, d.angle)
  })
  const polygonStr = polygon.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  // Calcular score global
  const validScores = dims.map(d => d.score).filter(s => s !== null)
  const globalScore = validScores.length
    ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(2)
    : null

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ maxWidth: '100%', height: 'auto' }}
      >
        {/* Círculos de fondo */}
        {levels.map(l => (
          <circle
            key={l}
            cx={cx} cy={cy}
            r={(l / maxScore) * maxR}
            fill="none"
            stroke="#d1d5db"
            strokeWidth={l === 5 ? 1.5 : 0.8}
            strokeDasharray={l < 5 ? '3 3' : 'none'}
          />
        ))}

        {/* Etiquetas de niveles */}
        {levels.map(l => (
          <text key={l} x={cx + 4} y={cy - (l / maxScore) * maxR + 4}
            fontSize="9" fill="#9ca3af" fontFamily="DM Mono, monospace">
            {l}
          </text>
        ))}

        {/* Ejes */}
        {dims.map((d, i) => {
          const outer = polarToCartesian(cx, cy, maxR, d.angle)
          return (
            <line key={i}
              x1={cx} y1={cy}
              x2={outer.x.toFixed(1)} y2={outer.y.toFixed(1)}
              stroke="#e5e7eb" strokeWidth="1"
            />
          )
        })}

        {/* Polígono relleno */}
        <polygon
          points={polygonStr}
          fill="rgba(0,192,75,0.08)"
          stroke="rgba(0,192,75,0.5)"
          strokeWidth="1.5"
        />

        {/* Puntos y etiquetas */}
        {dims.map((d, i) => {
          const r = (d.score / maxScore) * maxR
          const pt = polarToCartesian(cx, cy, r, d.angle)
          const labelPt = polarToCartesian(cx, cy, labelR, d.angle)
          const color = PILLAR_COLORS[d.pilar] || DEFAULT_COLOR

          // Calcular anclaje de texto
          const angleNorm = ((d.angle % 360) + 360) % 360
          let textAnchor = 'middle'
          if (angleNorm > 20 && angleNorm < 160) textAnchor = 'start'
          else if (angleNorm > 200 && angleNorm < 340) textAnchor = 'end'

          // Offset Y para labels arriba/abajo
          let dyLabel = 0
          if (angleNorm > 340 || angleNorm < 20) dyLabel = -8
          else if (angleNorm > 160 && angleNorm < 200) dyLabel = 10

          const label = lang === 'en' ? d.nameEn : d.name
          // Partir el label si es largo
          const words = label.split(' ')
          const mid = Math.ceil(words.length / 2)
          const line1 = words.slice(0, mid).join(' ')
          const line2 = words.slice(mid).join(' ')

          return (
            <g key={i}>
              {/* Punto */}
              <circle cx={pt.x.toFixed(1)} cy={pt.y.toFixed(1)}
                r="5" fill={color} stroke="white" strokeWidth="1.5" />

              {/* Score junto al punto */}
              <text
                x={(pt.x + (angleNorm < 180 ? 10 : -10)).toFixed(1)}
                y={(pt.y + 4).toFixed(1)}
                fontSize="9.5"
                fontWeight="600"
                fontFamily="DM Mono, monospace"
                fill={color}
                textAnchor={angleNorm < 180 ? 'start' : 'end'}
              >
                {d.score?.toFixed(2)}
              </text>

              {/* Label dimensión */}
              <text
                x={labelPt.x.toFixed(1)}
                y={(labelPt.y + dyLabel).toFixed(1)}
                fontSize="9"
                fontFamily="DM Sans, sans-serif"
                fill={color}
                fontWeight="500"
                textAnchor={textAnchor}
              >
                {line2 ? (
                  <>
                    <tspan x={labelPt.x.toFixed(1)} dy="0">{line1}</tspan>
                    <tspan x={labelPt.x.toFixed(1)} dy="11">{line2}</tspan>
                  </>
                ) : label}
              </text>
            </g>
          )
        })}

        {/* Score global en el centro */}
        {globalScore && (
          <g>
            <circle cx={cx} cy={cy} r="30" fill="white" stroke="#e5e7eb" strokeWidth="1" />
            <text x={cx} y={cy + 2} textAnchor="middle" dominantBaseline="middle"
              fontSize="18" fontWeight="800" fontFamily="DM Mono, monospace"
              fill="#1a5c2a">
              {globalScore}
            </text>
          </g>
        )}
      </svg>

      {/* Leyenda pilares */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '8px',
        justifyContent: 'center', marginTop: '12px'
      }}>
        {Object.entries(PILLAR_COLORS).map(([pilar, color]) => (
          <div key={pilar} style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            fontSize: '.7rem', color: '#6b7280'
          }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
            {lang === 'en' ? {
              'Gestión y Gobierno del Dato': 'Data Management & Governance',
              'Consumo de Información': 'Information Consumption',
              'Analítica Avanzada': 'Advanced Analytics',
              'Estrategia del Dato': 'Data Strategy',
            }[pilar] : pilar}
          </div>
        ))}
      </div>
    </div>
  )
}
