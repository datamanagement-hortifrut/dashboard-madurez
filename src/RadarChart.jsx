/**
 * RadarChart.jsx — Gráfico radar interactivo.
 * - Clic en etiqueta/punto → selecciona dimensión y dispara onSelectDim
 * - Dimensión seleccionada se resalta, las demás se atenúan
 */
import { useMemo } from 'react'

const PILLAR_COLORS = {
  'Gestión y Gobierno del Dato': '#2563eb',
  'Consumo de Información':       '#d97706',
  'Analítica Avanzada':           '#7c3aed',
  'Estrategia del Dato':          '#dc2626',
}
const DEFAULT_COLOR = '#6b8c74'
const PILLAR_EN = {
  'Gestión y Gobierno del Dato': 'Data Management & Governance',
  'Consumo de Información':      'Information Consumption',
  'Analítica Avanzada':          'Advanced Analytics',
  'Estrategia del Dato':         'Data Strategy',
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function splitLabel(label, maxChars = 17) {
  if (label.length <= maxChars) return [label]
  const words = label.split(' ')
  const lines = []
  let current = ''
  for (const word of words) {
    if ((current + ' ' + word).trim().length <= maxChars) {
      current = (current + ' ' + word).trim()
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

export default function RadarChart({
  dimensions,
  size          = 500,
  lang          = 'es',
  selectedDim   = null,       // dimensión seleccionada (clic en etiqueta)
  onSelectDim   = () => {},
  selectedPilar = null,       // pilar seleccionado (clic en leyenda)
  onSelectPilar = () => {},
}) {
  const MARGIN   = 115
  const totalW   = size + MARGIN * 2
  const totalH   = size + MARGIN * 2
  const cx       = totalW / 2
  const cy       = totalH / 2
  const maxR     = size * 0.42
  const labelR   = maxR + 54
  const levels   = [1, 2, 3, 4, 5]
  const maxScore = 5

  const dims = useMemo(() => {
    const entries = Object.entries(dimensions).filter(([, v]) => v.score !== null)
    return entries.map(([name, v], i) => ({
      name,
      nameEn: v.label_en || name,
      score:  v.score,
      pilar:  v.pilar,
      angle:  (360 / entries.length) * i,
    }))
  }, [dimensions])

  if (dims.length < 3) return null

  const polygon = dims.map(d => {
    const r = (d.score / maxScore) * maxR
    return polarToCartesian(cx, cy, r, d.angle)
  })
  const polygonStr = polygon.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  const validScores = dims.map(d => d.score).filter(Boolean)
  const globalScore = validScores.length
    ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(2)
    : null

  const hasSelection = !!selectedDim
  const hasPilarFilter = !!selectedPilar

  return (
    <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
      <svg
        width={totalW} height={totalH}
        viewBox={`0 0 ${totalW} ${totalH}`}
        style={{ maxWidth: '100%', height: 'auto' }}
      >
        {/* Círculos de fondo */}
        {levels.map(l => (
          <circle key={l} cx={cx} cy={cy}
            r={(l / maxScore) * maxR}
            fill="none"
            stroke={l === 5 ? '#9ca3af' : '#e5e7eb'}
            strokeWidth={l === 5 ? 1.2 : 0.8}
            strokeDasharray={l < 5 ? '4 4' : 'none'}
          />
        ))}

        {/* Etiquetas de niveles */}
        {levels.map(l => (
          <text key={l} x={cx + 5} y={cy - (l / maxScore) * maxR + 4}
            fontSize="9" fill="#9ca3af" fontFamily="DM Mono, monospace">
            {l}
          </text>
        ))}

        {/* Ejes */}
        {dims.map((d, i) => {
          const outer = polarToCartesian(cx, cy, maxR, d.angle)
          const isSelAxis  = d.name === selectedDim
          const isActiveAxis = !selectedPilar || d.pilar === selectedPilar
          return (
            <line key={i}
              x1={cx} y1={cy}
              x2={outer.x.toFixed(1)} y2={outer.y.toFixed(1)}
              stroke={isSelAxis ? PILLAR_COLORS[d.pilar] || DEFAULT_COLOR : isActiveAxis && selectedPilar ? PILLAR_COLORS[d.pilar] || DEFAULT_COLOR : '#e5e7eb'}
              strokeWidth={isSelAxis || (isActiveAxis && selectedPilar) ? 1.5 : 1}
              opacity={(hasSelection && !isSelAxis) || (selectedPilar && !isActiveAxis) ? 0.15 : 1}
            />
          )
        })}

        {/* Polígono base */}
        <polygon
          points={polygonStr}
          fill={(hasSelection || hasPilarFilter) ? 'rgba(0,192,75,0.04)' : 'rgba(0,192,75,0.09)'}
          stroke={(hasSelection || hasPilarFilter) ? 'rgba(0,192,75,0.2)' : 'rgba(0,192,75,0.55)'}
          strokeWidth="1.8"
        />

        {/* Si hay selección, dibujar solo el área de esa dimensión resaltada */}
        {hasSelection && (() => {
          const selIdx = dims.findIndex(d => d.name === selectedDim)
          if (selIdx < 0) return null
          const prev = (selIdx - 1 + dims.length) % dims.length
          const next = (selIdx + 1) % dims.length
          const pts  = [selIdx, prev, next].map(idx => {
            const r = (dims[idx].score / maxScore) * maxR
            return polarToCartesian(cx, cy, r, dims[idx].angle)
          })
          const color = PILLAR_COLORS[dims[selIdx].pilar] || DEFAULT_COLOR
          // Línea resaltada solo para esa dimensión
          const selPt = pts[0]
          return (
            <g>
              <line x1={cx} y1={cy}
                x2={selPt.x.toFixed(1)} y2={selPt.y.toFixed(1)}
                stroke={color} strokeWidth="2" opacity="0.8"
              />
            </g>
          )
        })()}

        {/* Puntos, scores y etiquetas */}
        {dims.map((d, i) => {
          const r         = (d.score / maxScore) * maxR
          const pt        = polarToCartesian(cx, cy, r, d.angle)
          const labelPt   = polarToCartesian(cx, cy, labelR, d.angle)
          const color     = PILLAR_COLORS[d.pilar] || DEFAULT_COLOR
          const angleN    = ((d.angle % 360) + 360) % 360
          const isSelected    = d.name === selectedDim
          const isPilarActive = !selectedPilar || d.pilar === selectedPilar
          const dimmed        = (hasSelection && !isSelected) || (!hasSelection && !isPilarActive && !!selectedPilar)
          const opacity       = dimmed ? 0.18 : 1

          let textAnchor = 'middle'
          if      (angleN > 15  && angleN < 165) textAnchor = 'start'
          else if (angleN > 195 && angleN < 345) textAnchor = 'end'

          let dyExtra = 0
          if (angleN > 160 && angleN < 200) dyExtra = 6

          const label  = lang === 'en' ? d.nameEn : d.name
          const lines  = splitLabel(label, 18)
          const lineH  = 13
          const blockH = lines.length * lineH
          const yStart = labelPt.y - blockH / 2 + lineH / 2 + dyExtra

          const scoreOffX   = angleN < 180 ? 10 : -10
          const scoreAnchor = angleN < 180 ? 'start' : 'end'

          // Zona clickeable: combina punto + etiqueta
          const hitPt = polarToCartesian(cx, cy, (labelR + maxR) / 2, d.angle)

          return (
            <g key={i}
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectDim(isSelected ? null : d.name)}
            >
              {/* Zona de clic invisible */}
              <circle
                cx={hitPt.x.toFixed(1)} cy={hitPt.y.toFixed(1)}
                r="38" fill="transparent"
              />

              {/* Resaltado fondo si seleccionado */}
              {isSelected && (
                <circle
                  cx={labelPt.x.toFixed(1)} cy={labelPt.y.toFixed(1)}
                  r="28" fill={color} opacity="0.08"
                />
              )}

              {/* Punto */}
              <circle
                cx={pt.x.toFixed(1)} cy={pt.y.toFixed(1)}
                r={isSelected ? 7 : 5}
                fill={color} stroke="white"
                strokeWidth={isSelected ? 2.5 : 1.5}
                opacity={opacity}
              />

              {/* Score numérico */}
              <text
                x={(pt.x + scoreOffX).toFixed(1)}
                y={(pt.y + 4).toFixed(1)}
                fontSize={isSelected ? '10.5' : '9.5'}
                fontWeight={isSelected ? '800' : '700'}
                fontFamily="DM Mono, monospace"
                fill={color}
                textAnchor={scoreAnchor}
                opacity={opacity}
              >
                {d.score?.toFixed(2)}
              </text>

              {/* Etiqueta dimensión */}
              {lines.map((line, li) => (
                <text key={li}
                  x={labelPt.x.toFixed(1)}
                  y={(yStart + li * lineH).toFixed(1)}
                  fontSize={isSelected ? '10.5' : '9.5'}
                  fontFamily="DM Sans, sans-serif"
                  fill={color}
                  fontWeight={isSelected ? '700' : '500'}
                  textAnchor={textAnchor}
                  opacity={opacity}
                  textDecoration={isSelected ? 'underline' : 'none'}
                >
                  {line}
                </text>
              ))}
            </g>
          )
        })}

        {/* Score global */}
        {globalScore && (
          <g>
            <circle cx={cx} cy={cy} r="34" fill="white" stroke="#e5e7eb" strokeWidth="1" />
            <text x={cx} y={cy + 1}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="18" fontWeight="800"
              fontFamily="DM Mono, monospace" fill="#1a5c2a">
              {globalScore}
            </text>
          </g>
        )}
      </svg>

      {/* Leyenda — clicable por pilar */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:'8px', justifyContent:'center', marginTop:12 }}>
        {Object.entries(PILLAR_COLORS).map(([pilar, color]) => {
          const isActive  = !selectedPilar || selectedPilar === pilar
          const isSelected = selectedPilar === pilar
          return (
            <div key={pilar}
              onClick={() => onSelectPilar(isSelected ? null : pilar)}
              style={{
                display:'flex', alignItems:'center', gap:6,
                fontSize:'.72rem', cursor:'pointer',
                padding:'4px 10px', borderRadius:20,
                border: `1.5px solid ${isSelected ? color : isActive ? '#e5e7eb' : '#f3f4f6'}`,
                background: isSelected ? color + '15' : 'transparent',
                color: isSelected ? color : isActive ? '#4b5563' : '#d1d5db',
                fontWeight: isSelected ? 700 : 400,
                transition: 'all .15s',
                userSelect: 'none',
              }}
            >
              <div style={{
                width:8, height:8, borderRadius:'50%',
                background: isActive ? color : '#d1d5db',
                flexShrink:0, transition:'background .15s',
              }} />
              {lang === 'en' ? PILLAR_EN[pilar] : pilar}
            </div>
          )
        })}
      </div>

      {/* Hint */}
      <div style={{ textAlign:'center', fontSize:'.68rem', color:'#9ca3af', marginTop:6 }}>
        {lang === 'en'
          ? '↑ Click a dimension or pillar to filter'
          : '↑ Haz clic en una dimensión o pilar para filtrar'}
      </div>
    </div>
  )
}
