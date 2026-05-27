/**
 * dataService.js
 * Lee Google Sheets via Apps Script y calcula scores de madurez.
 *
 * IMPORTANTE: las respuestas están invertidas en puntuación:
 *   R020101 (opción 1) = nivel más alto = 5 puntos
 *   R020105 (opción 5) = "No existe"    = 1 punto
 * El último dígito del ID de respuesta indica la posición (1..5).
 * Score = 6 - posición  →  posición 1 = score 5, posición 5 = score 1
 */

const SHEET_URL = import.meta.env.VITE_SHEET_URL || ''

// Nombres de las hojas por grupo
const SHEET_NAMES = [
  'Respuestas_G1', 'Respuestas_G2', 'Respuestas_G3', 'Respuestas_G4',
  'Respuestas_G5', 'Respuestas_G6', 'Respuestas_G7a', 'Respuestas_G7b',
  'Respuestas_G8b', 'Respuestas_G8c', 'Respuestas_G9',
]

/**
 * Convierte un ID de respuesta a score numérico (1-5).
 * R020101 → posición 1 → score 5 (mejor)
 * R020105 → posición 5 → score 1 (peor)
 */
export function answerToScore(answerId) {
  if (!answerId || typeof answerId !== 'string') return null
  const pos = parseInt(answerId.slice(-1), 10)
  if (isNaN(pos) || pos < 1 || pos > 5) return null
  return 6 - pos  // invertir: posición 1 = 5 puntos, posición 5 = 1 punto
}

/**
 * Obtiene todas las respuestas de todas las hojas del Google Sheet.
 * Retorna array de filas: [{email, nombre, cargo, pais, grupo, answers: {P0201: 'R020101', ...}}]
 */
export async function fetchAllResponses() {
  if (!SHEET_URL) throw new Error('VITE_SHEET_URL no configurada')

  const results = await Promise.allSettled(
    SHEET_NAMES.map(sheet =>
      fetch(`${SHEET_URL}?action=getAll&sheet=${encodeURIComponent(sheet)}`)
        .then(r => r.ok ? r.json() : { rows: [] })
        .catch(() => ({ rows: [] }))
    )
  )

  const allRows = []
  results.forEach((res, i) => {
    if (res.status === 'fulfilled' && res.value?.rows) {
      res.value.rows.forEach(row => {
        allRows.push({ ...row, sheet: SHEET_NAMES[i] })
      })
    }
  })
  return allRows
}

/**
 * Calcula el score promedio de una dimensión para un conjunto de filas.
 * dimension: objeto con { ids: ['P0201',...] }
 */
export function calcDimensionScore(rows, questionIds) {
  const scores = []
  rows.forEach(row => {
    if (!row.answers) return
    questionIds.forEach(qid => {
      const ans = row.answers[qid]
      const score = answerToScore(ans)
      if (score !== null) scores.push(score)
    })
  })
  if (scores.length === 0) return null
  return +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
}

/**
 * Calcula scores completos: por dimensión, por pilar y global.
 * Retorna { global, dimensions: {nombre: score}, pillars: {nombre: score}, byGroup, totalResponses, totalParticipants }
 */
export function calcScores(rows, questions, employees) {
  if (!rows.length) return null

  // Agrupar preguntas por dimensión
  const dimMap = {}
  questions.forEach(q => {
    if (!dimMap[q.dimension_short]) {
      dimMap[q.dimension_short] = {
        ids: [], pilar: q.pilar, label_en: q.dimension_short_en || q.dimension_short
      }
    }
    dimMap[q.dimension_short].ids.push(q.id)
  })

  // Scores por dimensión
  const dimensions = {}
  Object.entries(dimMap).forEach(([dim, info]) => {
    const score = calcDimensionScore(rows, info.ids)
    dimensions[dim] = { score, pilar: info.pilar, label_en: info.label_en, ids: info.ids }
  })

  // Scores por pilar
  const pillarScores = {}
  Object.values(dimensions).forEach(({ score, pilar }) => {
    if (score === null) return
    if (!pillarScores[pilar]) pillarScores[pilar] = []
    pillarScores[pilar].push(score)
  })
  const pillars = {}
  Object.entries(pillarScores).forEach(([pilar, scores]) => {
    pillars[pilar] = +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
  })

  // Score global
  const allDimScores = Object.values(dimensions).map(d => d.score).filter(s => s !== null)
  const global = allDimScores.length
    ? +(allDimScores.reduce((a, b) => a + b, 0) / allDimScores.length).toFixed(2)
    : null

  // Por grupo
  const byGroup = {}
  const groups = [...new Set(rows.map(r => r.grupo).filter(Boolean))]
  groups.forEach(g => {
    const gRows = rows.filter(r => r.grupo === g)
    const gScores = Object.entries(dimMap).map(([dim, info]) => ({
      dim,
      score: calcDimensionScore(gRows, info.ids)
    })).filter(d => d.score !== null)
    if (gScores.length) {
      byGroup[g] = +(gScores.reduce((a, b) => a + b.score, 0) / gScores.length).toFixed(2)
    }
  })

  // Por país
  const byPais = {}
  const paises = [...new Set(rows.map(r => r.pais).filter(Boolean))]
  paises.forEach(pais => {
    const pRows = rows.filter(r => r.pais === pais)
    const pScores = Object.entries(dimMap).map(([dim, info]) => ({
      score: calcDimensionScore(pRows, info.ids)
    })).filter(d => d.score !== null)
    if (pScores.length) {
      byPais[pais] = +(pScores.reduce((a, b) => a + b.score, 0) / pScores.length).toFixed(2)
    }
  })

  // Participación
  const totalParticipants = employees.length
  const totalResponses    = rows.length
  const byGroupParticip   = {}
  const empByGroup = {}
  employees.forEach(e => {
    if (!empByGroup[e.grupo]) empByGroup[e.grupo] = 0
    empByGroup[e.grupo]++
  })
  groups.forEach(g => {
    const responded  = rows.filter(r => r.grupo === g).length
    const total      = empByGroup[g] || 0
    byGroupParticip[g] = { responded, total, pct: total ? Math.round(responded / total * 100) : 0 }
  })

  return { global, dimensions, pillars, byGroup, byPais, totalResponses, totalParticipants, byGroupParticip }
}

/**
 * Filtra filas por área o país.
 */
export function filterRows(rows, { pais, area, grupo } = {}) {
  return rows.filter(r => {
    if (pais  && r.pais  !== pais)  return false
    if (area  && r.area  !== area)  return false
    if (grupo && r.grupo !== grupo) return false
    return true
  })
}
