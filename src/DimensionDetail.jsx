/**
 * DimensionDetail.jsx
 * Panel lateral que aparece al seleccionar una dimensión en el radar.
 * Muestra: nombre, score, pilar, descripción y el desglose
 * pregunta por pregunta con barras de distribución de respuestas.
 */

const PILLAR_COLORS = {
  'Gestión y Gobierno del Dato': '#2563eb',
  'Consumo de Información':       '#d97706',
  'Analítica Avanzada':           '#7c3aed',
  'Estrategia del Dato':          '#dc2626',
}
const PILLAR_EN = {
  'Gestión y Gobierno del Dato': 'Data Management & Governance',
  'Consumo de Información':      'Information Consumption',
  'Analítica Avanzada':          'Advanced Analytics',
  'Estrategia del Dato':         'Data Strategy',
}

function scoreColor(s) {
  if (!s) return '#9ca3af'
  if (s >= 4.5) return '#059669'
  if (s >= 3.5) return '#16a34a'
  if (s >= 2.5) return '#ca8a04'
  if (s >= 1.5) return '#ea580c'
  return '#dc2626'
}
function maturityLabel(s, lang) {
  if (!s) return '—'
  const es = s >= 4.5 ? 'Optimizado' : s >= 3.5 ? 'Avanzado' : s >= 2.5 ? 'En desarrollo' : s >= 1.5 ? 'Inicial' : 'Inexistente'
  const en = s >= 4.5 ? 'Optimized'  : s >= 3.5 ? 'Advanced' : s >= 2.5 ? 'Developing'    : s >= 1.5 ? 'Initial'  : 'Non-existent'
  return lang === 'en' ? en : es
}
function answerToScore(answerId) {
  if (!answerId) return null
  const pos = parseInt(answerId.slice(-1), 10)
  if (isNaN(pos) || pos < 1 || pos > 5) return null
  return 6 - pos
}

export default function DimensionDetail({ dimName, rows, questions, lang, onClose }) {
  if (!dimName) return null

  // Preguntas de esta dimensión
  const dimQuestions = questions.filter(q => q.dimension_short === dimName)
  if (!dimQuestions.length) return null

  const pilar     = dimQuestions[0].pilar
  const pilarEn   = dimQuestions[0].pilar_en || pilar
  const descripES = dimQuestions[0].descripcion    || ''
  const descripEN = dimQuestions[0].descripcion_en || descripES
  const color     = PILLAR_COLORS[pilar] || '#6b8c74'

  // Calcular score promedio de la dimensión
  const allScores = []
  dimQuestions.forEach(q => {
    rows.forEach(row => {
      const s = answerToScore(row.answers?.[q.id])
      if (s !== null) allScores.push(s)
    })
  })
  const avgScore = allScores.length
    ? +(allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(2)
    : null

  // Por pregunta: score promedio + distribución de respuestas
  const questionDetails = dimQuestions.map(q => {
    const scores  = []
    const distrib = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    rows.forEach(row => {
      const ans = row.answers?.[q.id]
      const s   = answerToScore(ans)
      if (s !== null) {
        scores.push(s)
        distrib[s] = (distrib[s] || 0) + 1
      }
    })
    const avg = scores.length
      ? +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
      : null
    const total = scores.length
    return { q, avg, distrib, total }
  })

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0,
      width: 420, height: '100vh',
      background: '#fff',
      boxShadow: '-4px 0 32px rgba(0,0,0,.12)',
      zIndex: 200,
      display: 'flex', flexDirection: 'column',
      animation: 'slideIn .2s ease',
    }}>
      <style>{`
        @keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }
      `}</style>

      {/* Header */}
      <div style={{
        background: color, color: '#fff',
        padding: '18px 20px',
        flexShrink: 0,
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
            <div style={{ fontSize:'.7rem', fontWeight:700, letterSpacing:'.5px',
              textTransform:'uppercase', opacity:.75, marginBottom:4 }}>
              {lang === 'en' ? pilarEn : pilar}
            </div>
            <div style={{ fontSize:'1rem', fontWeight:700, lineHeight:1.3 }}>
              {lang === 'en' ? (dimQuestions[0].dimension_short_en || dimName) : dimName}
            </div>
            {(lang === 'en' ? descripEN : descripES) && (
              <div style={{ fontSize:'.75rem', opacity:.8, marginTop:5, lineHeight:1.4 }}>
                {lang === 'en' ? descripEN : descripES}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{
            background:'rgba(255,255,255,.2)', border:'none', color:'#fff',
            width:28, height:28, borderRadius:6, cursor:'pointer',
            fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center',
            flexShrink:0,
          }}>✕</button>
        </div>

        {/* Score badge */}
        <div style={{ display:'flex', alignItems:'baseline', gap:8, marginTop:14 }}>
          <span style={{
            fontFamily:'DM Mono, monospace', fontSize:'2.2rem',
            fontWeight:800, color:'#fff',
          }}>{avgScore ?? '—'}</span>
          <span style={{ fontSize:'.8rem', opacity:.8 }}>
            / 5 · {maturityLabel(avgScore, lang)}
          </span>
          <span style={{ marginLeft:'auto', fontSize:'.75rem', opacity:.7 }}>
            {allScores.length} {lang === 'en' ? 'responses' : 'respuestas'}
          </span>
        </div>

        {/* Barra de score */}
        <div style={{ height:4, background:'rgba(255,255,255,.25)', borderRadius:2, marginTop:8, overflow:'hidden' }}>
          <div style={{
            height:'100%', background:'rgba(255,255,255,.85)',
            borderRadius:2,
            width: avgScore ? `${(avgScore / 5) * 100}%` : '0%',
            transition:'width .4s ease',
          }} />
        </div>
      </div>

      {/* Body — preguntas */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
        {questionDetails.map(({ q, avg, distrib, total }, qi) => {
          const pText = lang === 'en' ? (q.pregunta_en || q.pregunta) : q.pregunta
          return (
            <div key={q.id} style={{
              marginBottom: 18,
              paddingBottom: 18,
              borderBottom: qi < questionDetails.length - 1 ? '1px solid #f3f4f6' : 'none',
            }}>
              {/* ID + score */}
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                <span style={{
                  fontFamily:'DM Mono, monospace', fontSize:'.65rem',
                  background:'#f3f4f6', color:'#6b7280',
                  padding:'2px 7px', borderRadius:4, flexShrink:0,
                }}>{q.id}</span>
                {avg !== null && (
                  <span style={{
                    fontFamily:'DM Mono, monospace', fontSize:'.8rem',
                    fontWeight:700, color: scoreColor(avg),
                    marginLeft:'auto', flexShrink:0,
                  }}>{avg}</span>
                )}
              </div>

              {/* Pregunta */}
              <div style={{ fontSize:'.82rem', fontWeight:500, color:'#1f2937', lineHeight:1.45, marginBottom:10 }}>
                {pText}
              </div>

              {/* Distribución de respuestas — barras por opción */}
              {total > 0 && (
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {q.opciones.map((opt, oi) => {
                    const s      = 5 - oi           // score: opción 1 = 5, opción 5 = 1
                    const count  = distrib[s] || 0
                    const pct    = total > 0 ? Math.round(count / total * 100) : 0
                    const optTxt = lang === 'en' ? (opt.texto_en || opt.texto) : opt.texto
                    const barCol = s >= 4 ? '#16a34a' : s === 3 ? '#ca8a04' : s === 2 ? '#ea580c' : '#dc2626'
                    return (
                      <div key={opt.id} style={{ display:'flex', alignItems:'center', gap:7 }}>
                        {/* Score pill */}
                        <span style={{
                          fontFamily:'DM Mono, monospace', fontSize:'.65rem',
                          fontWeight:700, color: barCol,
                          width:14, textAlign:'center', flexShrink:0,
                        }}>{s}</span>
                        {/* Barra */}
                        <div style={{ flex:1, height:7, background:'#f3f4f6', borderRadius:3, overflow:'hidden' }}>
                          <div style={{
                            height:'100%', width:`${pct}%`,
                            background: barCol,
                            borderRadius:3,
                            transition:'width .4s ease',
                            opacity: count > 0 ? 1 : 0,
                          }} />
                        </div>
                        {/* % y texto */}
                        <span style={{
                          fontFamily:'DM Mono, monospace', fontSize:'.65rem',
                          color:'#9ca3af', width:28, textAlign:'right', flexShrink:0,
                        }}>{count > 0 ? `${pct}%` : ''}</span>
                        {/* Texto de la opción */}
                        <span style={{
                          fontSize:'.65rem', color:'#6b7280',
                          width:130, lineHeight:1.3, flexShrink:0,
                          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                        }} title={optTxt}>{optTxt}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {total === 0 && (
                <div style={{ fontSize:'.75rem', color:'#9ca3af', fontStyle:'italic' }}>
                  {lang === 'en' ? 'No responses yet' : 'Sin respuestas aún'}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
