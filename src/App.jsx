import React, { useState, useEffect, useMemo } from 'react'
/**
 * App.jsx — Dashboard de Madurez de Datos
 * Lee Google Sheets, calcula scores y muestra:
 * - KPIs de participación
 * - Radar chart a nivel compañía y por área/país
 * - Tabla de dimensiones con scores
 * - Avance de respuestas por grupo
 */

import { fetchAllResponses, calcScores, filterRows } from './dataService.js'
import RadarChart from './RadarChart.jsx'
import DimensionDetail from './DimensionDetail.jsx'
import questionsData from './questions.json'
import employeesData from './employees.json'
import clevelsData   from './clevels.json'

// ── Helpers ────────────────────────────────────────────────
const PILLAR_CLASS = {
  'Gestión y Gobierno del Dato': 'p1',
  'Consumo de Información':      'p2',
  'Analítica Avanzada':          'p3',
  'Estrategia del Dato':         'p4',
}
const PILLAR_EN = {
  'Gestión y Gobierno del Dato': 'Data Management & Governance',
  'Consumo de Información':      'Information Consumption',
  'Analítica Avanzada':          'Advanced Analytics',
  'Estrategia del Dato':         'Data Strategy',
}
const GROUP_NAMES = {
  G1:'Alta Dirección', G2:'Directores/Gerentes', G3:'Jefes/Subgerentes',
  G4:'Datos/BI/Analytics', G5:'TI/Tecnología', G6:'Creadores Reportes',
  G7a:'Consumidores Reportes', G7b:'Profesionales Negocio',
  G8b:'Aprobadores MDM', G8c:'Operadores MDM', G9:'Data Owners',
}
function scoreClass(s) {
  if (!s) return ''
  if (s >= 4.5) return 'score-5'
  if (s >= 3.5) return 'score-4'
  if (s >= 2.5) return 'score-3'
  if (s >= 1.5) return 'score-2'
  return 'score-1'
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

// ── Subcomponentes ──────────────────────────────────────────
function KPICard({ label, value, sub, pct, color }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color: color || undefined }}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
      {pct !== undefined && (
        <div className="kpi-bar">
          <div className="kpi-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  )
}

function DimensionRow({ name, score, pilar, lang }) {
  const pct = score ? (score / 5 * 100) : 0
  return (
    <div className="progress-row">
      <span className={`pillar-chip ${PILLAR_CLASS[pilar] || 'p1'}`} style={{ fontSize: '.62rem', padding: '2px 7px' }}>
        {lang === 'en' ? PILLAR_EN[pilar] : pilar}
      </span>
      <span className="progress-label" style={{ marginLeft: 4 }}>{name}</span>
      <div className="progress-bar-wrap" style={{ width: 80 }}>
        <div className="progress-bar-fill"
          style={{ width: `${pct}%`, background: scoreColor(score) }} />
      </div>
      <span className={`score-badge ${scoreClass(score)}`}>{score?.toFixed(2) ?? '—'}</span>
    </div>
  )
}

function GroupProgress({ group, data, lang }) {
  const { responded, total } = data
  const pct = total > 0 ? +(responded / total * 100).toFixed(2) : 0
  return (
    <div className="progress-row">
      <span className="progress-label">{lang === 'en' ? group : (GROUP_NAMES[group] || group)}</span>
      <div className="progress-bar-wrap">
        <div className="progress-bar-fill"
          style={{ width: `${pct}%`, background: pct === 100 ? '#16a34a' : pct > 50 ? '#ca8a04' : '#2563eb' }} />
      </div>
      <span className="progress-pct">{pct}%</span>
      <span className="progress-count">{responded}/{total}</span>
    </div>
  )
}

// ── Vista: Overview ─────────────────────────────────────────
function OverviewView({ scores, rows, questions, lang }) {
  const [selectedDim,   setSelectedDim]   = React.useState(null)
  const [selectedPilar, setSelectedPilar] = React.useState(null)
  if (!scores) return (
    <div className="loading-center">
      <div style={{ fontSize: '2rem' }}>📊</div>
      <p>{lang === 'en' ? 'No responses yet' : 'Aún no hay respuestas registradas'}</p>
    </div>
  )

  const topDims = Object.entries(scores.dimensions)
    .filter(([, v]) => v.score !== null)
    .sort((a, b) => b[1].score - a[1].score)
  const best3  = topDims.slice(0, 3)
  const worst3 = topDims.slice(-3).reverse()

  return (
    <div>
      {/* KPIs */}
      <div className="kpi-grid">
        <KPICard
          label={lang === 'en' ? 'Company Score' : 'Score Compañía'}
          value={scores.global?.toFixed(2) ?? '—'}
          sub={maturityLabel(scores.global, lang)}
          color={scoreColor(scores.global)}
        />
        <KPICard
          label={lang === 'en' ? 'Responses' : 'Respuestas'}
          value={scores.totalResponses}
          sub={`${lang === 'en' ? 'of' : 'de'} ${scores.totalParticipants} ${lang === 'en' ? 'people' : 'personas'}`}
          pct={scores.totalParticipants > 0 ? scores.totalResponses / scores.totalParticipants * 100 : 0}
        />
        <KPICard
          label={lang === 'en' ? 'Participation' : 'Participación'}
          value={scores.totalParticipants > 0 ? `${(scores.totalResponses / scores.totalParticipants * 100).toFixed(2)}%` : '0%'}
          sub={lang === 'en' ? 'response rate' : 'tasa de respuesta'}
          pct={scores.totalParticipants > 0 ? scores.totalResponses / scores.totalParticipants * 100 : 0}
        />
        <KPICard
          label={lang === 'en' ? 'Dimensions evaluated' : 'Dimensiones evaluadas'}
          value={Object.values(scores.dimensions).filter(d => d.score !== null).length}
          sub={`${lang === 'en' ? 'of' : 'de'} 21 ${lang === 'en' ? 'total' : 'totales'}`}
          pct={Object.values(scores.dimensions).filter(d => d.score !== null).length / 21 * 100}
        />
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Radar compañía */}
        <div className="card card-pad">
          <div className="section-title">
            {lang === 'en' ? 'Company Level' : 'Nivel Compañía'}
          </div>
          <div className="radar-wrap">
            <RadarChart dimensions={scores.dimensions} size={440} lang={lang}
              selectedDim={selectedDim}     onSelectDim={setSelectedDim}
              selectedPilar={selectedPilar} onSelectPilar={(p) => { setSelectedPilar(p); setSelectedDim(null) }} />
          </div>
        </div>

        {/* Scores por pilar + avance grupos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card card-pad">
            <div className="section-title">{lang === 'en' ? 'Score by Pillar' : 'Score por Pilar'}</div>
            {Object.entries(scores.pillars).sort((a, b) => b[1] - a[1]).map(([pilar, score]) => (
              <div key={pilar} className="progress-row">
                <span className={`pillar-chip ${PILLAR_CLASS[pilar] || 'p1'}`}>
                  {lang === 'en' ? PILLAR_EN[pilar] : pilar}
                </span>
                <div className="progress-bar-wrap" style={{ flex: 1 }}>
                  <div className="progress-bar-fill"
                    style={{ width: `${score / 5 * 100}%`, background: scoreColor(score) }} />
                </div>
                <span className={`score-badge ${scoreClass(score)}`}>{score?.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="card card-pad">
            <div className="section-title">{lang === 'en' ? 'Response progress by group' : 'Avance de respuestas por grupo'}</div>
            {Object.entries(scores.byGroupParticip).sort((a, b) => b[1].pct - a[1].pct).map(([g, data]) => (
              <GroupProgress key={g} group={g} data={data} lang={lang} />
            ))}
          </div>
        </div>
      </div>

      {/* Highlights */}
      <div className="grid-2">
        <div className="card card-pad">
          <div className="section-title" style={{ '--clr': '#16a34a', color: '#16a34a' }}>
            🏆 {lang === 'en' ? 'Top 3 Dimensions' : 'Top 3 Dimensiones'}
          </div>
          {best3.map(([name, v]) => (
            <DimensionRow key={name} name={name} score={v.score} pilar={v.pilar} lang={lang} />
          ))}
        </div>
        <div className="card card-pad">
          <div className="section-title" style={{ color: '#dc2626' }}>
            ⚠️ {lang === 'en' ? 'Bottom 3 Dimensions' : '3 Dimensiones a mejorar'}
          </div>
          {worst3.map(([name, v]) => (
            <DimensionRow key={name} name={name} score={v.score} pilar={v.pilar} lang={lang} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Vista: Dimensiones (tabla completa) ─────────────────────
function DimensionsView({ scores, lang }) {
  if (!scores) return <div className="loading-center"><p>{lang === 'en' ? 'No data' : 'Sin datos'}</p></div>

  const sorted = Object.entries(scores.dimensions)
    .filter(([, v]) => v.score !== null)
    .sort((a, b) => {
      const pa = a[1].pilar, pb = b[1].pilar
      if (pa !== pb) return pa.localeCompare(pb)
      return (b[1].score || 0) - (a[1].score || 0)
    })

  return (
    <div className="card">
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>{lang === 'en' ? 'Pillar' : 'Pilar'}</th>
              <th>{lang === 'en' ? 'Dimension' : 'Dimensión'}</th>
              <th>{lang === 'en' ? 'Score' : 'Score'}</th>
              <th>{lang === 'en' ? 'Level' : 'Nivel'}</th>
              <th>{lang === 'en' ? 'Progress' : 'Progreso'}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(([name, v]) => (
              <tr key={name}>
                <td>
                  <span className={`pillar-chip ${PILLAR_CLASS[v.pilar] || 'p1'}`}>
                    {lang === 'en' ? PILLAR_EN[v.pilar] : v.pilar}
                  </span>
                </td>
                <td style={{ fontWeight: 500 }}>{lang === 'en' ? (v.label_en || name) : name}</td>
                <td>
                  <span className={`score-badge ${scoreClass(v.score)}`}>{v.score?.toFixed(2)}</span>
                </td>
                <td style={{ color: scoreColor(v.score), fontSize: '.78rem', fontWeight: 600 }}>
                  {maturityLabel(v.score, lang)}
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="progress-bar-wrap" style={{ width: 100 }}>
                      <div className="progress-bar-fill"
                        style={{ width: `${v.score / 5 * 100}%`, background: scoreColor(v.score) }} />
                    </div>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '.72rem', color: '#6b7280' }}>
                      {(v.score / 5 * 100).toFixed(0)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Vista: Por País / Área ──────────────────────────────────
function FilteredView({ rows, questions, employees, lang }) {
  const paises = useMemo(() => [...new Set(rows.map(r => r.pais).filter(Boolean))].sort(), [rows])
  const [selPais, setSelPais] = useState('')

  const filteredRows = useMemo(() =>
    selPais ? rows.filter(r => r.pais === selPais) : rows,
    [rows, selPais]
  )

  const scores = useMemo(() =>
    calcScores(filteredRows, questions, employees),
    [filteredRows, questions, employees]
  )

  const title = selPais
    ? `${lang === 'en' ? 'Score for' : 'Score para'} ${selPais}`
    : lang === 'en' ? 'All Countries' : 'Todos los países'

  const [selectedDim,   setSelectedDim]   = React.useState(null)
  const [selectedPilar, setSelectedPilar] = React.useState(null)
  return (
    <div>
      <div className="filter-bar">
        <span className="filter-label">{lang === 'en' ? 'Country:' : 'País:'}</span>
        <select className="filter-select" value={selPais} onChange={e => setSelPais(e.target.value)}>
          <option value="">{lang === 'en' ? 'All countries' : 'Todos los países'}</option>
          {paises.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {selPais && (
          <button className="btn btn-ghost" onClick={() => setSelPais('')}>✕ {lang === 'en' ? 'Clear' : 'Limpiar'}</button>
        )}
      </div>

      {!scores ? (
        <div className="loading-center">
          <p>{lang === 'en' ? 'No responses for this filter' : 'No hay respuestas para este filtro'}</p>
        </div>
      ) : (
        <div className="grid-2">
          <div className="card card-pad">
            <div className="section-title">{title}</div>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '2.2rem', fontWeight: 800, color: scoreColor(scores.global) }}>
                {scores.global?.toFixed(2)}
              </span>
              <div style={{ fontSize: '.8rem', color: '#6b7280', marginTop: 2 }}>
                {maturityLabel(scores.global, lang)} · {scores.totalResponses} {lang === 'en' ? 'of' : 'de'} {scores.totalParticipants} {lang === 'en' ? 'people' : 'personas'}
              </div>
            </div>
            <div className="radar-wrap">
              <RadarChart dimensions={scores.dimensions} size={420} lang={lang}
              selectedDim={selectedDim}     onSelectDim={setSelectedDim}
              selectedPilar={selectedPilar} onSelectPilar={(p) => { setSelectedPilar(p); setSelectedDim(null) }} />
            </div>
          </div>
          <div className="card card-pad">
            <div className="section-title">{lang === 'en' ? 'Dimensions' : 'Dimensiones'}</div>
            {Object.entries(scores.dimensions)
              .filter(([, v]) => v.score !== null)
              .sort((a, b) => (b[1].score || 0) - (a[1].score || 0))
              .map(([name, v]) => (
                <DimensionRow key={name} name={lang === 'en' ? (v.label_en || name) : name}
                  score={v.score} pilar={v.pilar} lang={lang} />
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Vista: Por Grupo ────────────────────────────────────────
function GroupsView({ rows, questions, employees, lang }) {
  const groups = useMemo(() => [...new Set(rows.map(r => r.grupo).filter(Boolean))].sort(), [rows])
  const [selGroup,      setSelGroup]      = useState(groups[0] || '')
  const [selectedDim,   setSelectedDim]   = React.useState(null)
  const [selectedPilar, setSelectedPilar] = React.useState(null)

  const filteredRows = useMemo(() =>
    selGroup ? rows.filter(r => r.grupo === selGroup) : rows,
    [rows, selGroup]
  )

  const scores = useMemo(() =>
    calcScores(filteredRows, questions, employees.filter(e => !selGroup || e.grupo === selGroup)),
    [filteredRows, questions, employees, selGroup]
  )

  return (
    <div>
      <div className="filter-bar">
        <span className="filter-label">{lang === 'en' ? 'Group:' : 'Grupo:'}</span>
        {groups.map(g => (
          <button key={g}
            className={`btn ${selGroup === g ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '5px 12px', fontSize: '.75rem' }}
            onClick={() => setSelGroup(g)}>
            {g}
          </button>
        ))}
      </div>

      {!scores ? (
        <div className="loading-center">
          <p>{lang === 'en' ? 'No responses for this group' : 'Sin respuestas para este grupo'}</p>
        </div>
      ) : (
        <div className="grid-2">
          <div className="card card-pad">
            <div className="section-title">
              {selGroup} — {GNAMES[selGroup] || selGroup}
            </div>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '2.2rem', fontWeight: 800, color: scoreColor(scores.global) }}>
                {scores.global?.toFixed(2)}
              </span>
              <div style={{ fontSize: '.8rem', color: '#6b7280', marginTop: 2 }}>
                {maturityLabel(scores.global, lang)} · {scores.totalResponses} {lang === 'en' ? 'of' : 'de'} {scores.totalParticipants} {lang === 'en' ? 'people' : 'personas'}
              </div>
            </div>
            <div className="radar-wrap">
              <RadarChart dimensions={scores.dimensions} size={420} lang={lang}
            selectedDim={selectedDim}     onSelectDim={setSelectedDim}
            selectedPilar={selectedPilar} onSelectPilar={(p) => { setSelectedPilar(p); setSelectedDim(null) }} />
            </div>
          </div>
          <div className="card card-pad">
            <div className="section-title">{lang === 'en' ? 'Dimensions' : 'Dimensiones'}</div>
            {Object.entries(scores.dimensions)
              .filter(([, v]) => v.score !== null)
              .sort((a, b) => (b[1].score || 0) - (a[1].score || 0))
              .map(([name, v]) => (
                <DimensionRow key={name} name={lang === 'en' ? (v.label_en || name) : name}
                  score={v.score} pilar={v.pilar} lang={lang} />
              ))}
          </div>
        </div>
      )}
    </div>
  )
}


// ── Vista: Participación detallada por grupo ─────────────────
const GNAMES = {
  G1:'Alta Dirección & C-Level', G2:'Directores & Gerentes',
  G3:'Jefes & Subgerentes',      G4:'Datos, BI & Analytics',
  G5:'TI & Tecnología',          G6:'Creadores de Reportes',
  G7a:'Consumidores de Reportes',G7b:'Profesionales de Negocio',
  G8b:'Aprobadores MDM',         G8c:'Operadores MDM',
  G9:'Data Owners',
}
const GROUP_ORDER = ['G1','G2','G3','G4','G5','G6','G7a','G7b','G8b','G8c','G9']
const GROUP_COLORS_HEX = {
  G1:'#C00000', G2:'#E26B0A', G3:'#F79646', G4:'#4472C4',
  G5:'#2E75B6', G6:'#70AD47', G7a:'#5B9BD5', G7b:'#4BACC6',
  G8b:'#9E48C6', G8c:'#B07FD4', G9:'#1F3864',
}

// ── Vista: Participación detallada ───────────────────────────
const PART_GROUPS = ['TODOS','G1','G2','G3','G4','G5','G6','G7a','G7b','G8b','G8c','G9']
const PART_NAMES  = {
  TODOS:'Todos los Grupos',
  G1:'Alta Dirección',  G2:'Directores/Gerentes', G3:'Jefes/Subgerentes',
  G4:'Datos & BI',      G5:'TI & Tecnología',     G6:'Creadores Reportes',
  G7a:'Consumidores',   G7b:'Profesionales',       G8b:'Aprobadores MDM',
  G8c:'Operadores MDM', G9:'Data Owners',
}
const PART_COLORS = {
  TODOS:'#1a5c2a',
  G1:'#C00000', G2:'#E26B0A', G3:'#F79646', G4:'#4472C4', G5:'#2E75B6',
  G6:'#70AD47', G7a:'#5B9BD5', G7b:'#4BACC6', G8b:'#9E48C6', G8c:'#B07FD4', G9:'#1F3864',
}

function downloadExcel(data, filename) {
  // Generar CSV con BOM para que Excel abra correctamente con tildes
  const BOM = '\uFEFF'
  const headers = ['Grupo','Nombre del Grupo','Nombre','Cargo','País','Correo','Estado']
  const rows = data.map(e => [
    e.grupo,
    PART_NAMES[e.grupo] || e.grupo,
    e.nombre || '',
    e.cargo  || '',
    e.pais   || '',
    (e.email || '').toLowerCase(),
    e.answered ? 'Respondió' : 'Pendiente',
  ])
  const csv = BOM + [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function ParticipationView({ rows, employees, lang, loading }) {
  const [selGroup, setSelGroup] = useState('TODOS')
  const [search,   setSearch]   = useState('')
  const [filter,   setFilter]   = useState('all')

  const respondedSet = new Set(
    (rows || []).map(r => (r.email || '').toLowerCase().trim()).filter(Boolean)
  )

  const color = PART_COLORS[selGroup] || '#1a5c2a'

  // Stats por grupo (sin TODOS)
  const groupStats = ['G1','G2','G3','G4','G5','G6','G7a','G7b','G8b','G8c','G9'].map(g => {
    const emps = (employees || []).filter(e => e.grupo === g)
    const resp = emps.filter(e => respondedSet.has((e.email || '').toLowerCase().trim())).length
    const pct  = emps.length > 0 ? +(resp / emps.length * 100).toFixed(1) : 0
    return { g, total: emps.length, resp, pct }
  })

  // Stats para TODOS
  const totalEmps = (employees || []).length
  const totalResp = (employees || []).filter(e => respondedSet.has((e.email || '').toLowerCase().trim())).length
  const totalPct  = totalEmps > 0 ? +(totalResp / totalEmps * 100).toFixed(1) : 0
  const todosStats = { g:'TODOS', total: totalEmps, resp: totalResp, pct: totalPct }

  const allStats = [todosStats, ...groupStats]
  const selStat  = allStats.find(s => s.g === selGroup) || { total:0, resp:0, pct:0 }

  // Lista según grupo seleccionado
  const baseList = selGroup === 'TODOS'
    ? (employees || [])
    : (employees || []).filter(e => e.grupo === selGroup)

  const groupList = baseList
    .map(e => ({ ...e, answered: respondedSet.has((e.email || '').toLowerCase().trim()) }))
    .sort((a, b) => {
      if (a.answered !== b.answered) return a.answered ? 1 : -1
      if (selGroup === 'TODOS') {
        const ga = a.grupo || '', gb = b.grupo || ''
        if (ga !== gb) return ga.localeCompare(gb)
      }
      return (a.nombre || '').localeCompare(b.nombre || '')
    })

  const filtered = groupList.filter(e => {
    if (filter === 'answered' && !e.answered) return false
    if (filter === 'pending'  &&  e.answered) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (e.nombre || '').toLowerCase().includes(q) ||
             (e.cargo  || '').toLowerCase().includes(q) ||
             (e.email  || '').toLowerCase().includes(q) ||
             (e.pais   || '').toLowerCase().includes(q) ||
             (e.grupo  || '').toLowerCase().includes(q)
    }
    return true
  })

  const pendingCount  = groupList.filter(e => !e.answered).length
  const answeredCount = groupList.filter(e =>  e.answered).length

  const handleDownload = () => {
    const grpLabel = selGroup === 'TODOS' ? 'todos-los-grupos' : selGroup.toLowerCase()
    const fname = `participacion-${grpLabel}-${new Date().toISOString().slice(0,10)}.csv`
    downloadExcel(filtered, fname)
  }

  return (
    <div>
      {/* Chips de grupo */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:20 }}>
        {allStats.map(({ g, total, resp, pct }) => (
          <div key={g}
            onClick={() => { setSelGroup(g); setSearch(''); setFilter('all') }}
            style={{
              background: selGroup === g ? PART_COLORS[g] : '#fff',
              border: `2px solid ${selGroup === g ? PART_COLORS[g] : '#e5e7eb'}`,
              borderRadius:10, padding:'10px 14px', cursor:'pointer', transition:'all .15s',
              minWidth: g === 'TODOS' ? 120 : 90, textAlign:'center',
            }}
          >
            <div style={{ fontSize:'.68rem', fontWeight:700, color: selGroup===g ? 'rgba(255,255,255,.75)' : '#6b7280', marginBottom:2 }}>
              {g === 'TODOS' ? (lang==='en'?'ALL':'TODOS') : g}
            </div>
            <div style={{ fontFamily:'DM Mono, monospace', fontSize:'1.2rem', fontWeight:800, color: selGroup===g ? '#fff' : PART_COLORS[g], lineHeight:1 }}>
              {pct}%
            </div>
            <div style={{ fontSize:'.65rem', color: selGroup===g ? 'rgba(255,255,255,.6)' : '#9ca3af', marginTop:2 }}>
              {resp}/{total}
            </div>
            <div style={{ marginTop:5, height:3, background: selGroup===g ? 'rgba(255,255,255,.25)' : '#f3f4f6', borderRadius:2, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${pct}%`, background: selGroup===g ? 'rgba(255,255,255,.7)' : PART_COLORS[g], borderRadius:2 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Panel detalle */}
      <div className="card">
        {/* Header */}
        <div style={{ background: color, color:'#fff', padding:'14px 20px', borderRadius:'12px 12px 0 0', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
          <div>
            <div style={{ fontSize:'.68rem', opacity:.7, textTransform:'uppercase', letterSpacing:'.4px', marginBottom:2 }}>{selGroup}</div>
            <div style={{ fontSize:'.95rem', fontWeight:700 }}>{lang==='en' && selGroup==='TODOS' ? 'All Groups' : PART_NAMES[selGroup]}</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            {loading && <div className="spinner" style={{ width:14, height:14, borderWidth:2, borderTopColor:'#fff', borderColor:'rgba(255,255,255,.3)' }} />}
            <div style={{ textAlign:'right' }}>
              <div style={{ fontFamily:'DM Mono, monospace', fontSize:'1.5rem', fontWeight:800 }}>{selStat.pct}%</div>
              <div style={{ fontSize:'.7rem', opacity:.7 }}>{selStat.resp} {lang==='en'?'of':'de'} {selStat.total} {lang==='en'?'people':'personas'}</div>
            </div>
            {/* Botón descargar Excel */}
            <button
              onClick={handleDownload}
              title={lang==='en' ? 'Download Excel' : 'Descargar Excel'}
              style={{
                background:'rgba(255,255,255,.2)', border:'1px solid rgba(255,255,255,.4)',
                color:'#fff', borderRadius:7, padding:'7px 14px',
                fontSize:'.78rem', fontWeight:600, cursor:'pointer',
                fontFamily:'inherit', display:'flex', alignItems:'center', gap:6,
                transition:'background .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.35)'}
              onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,.2)'}
            >
              📥 {lang==='en' ? 'Download' : 'Descargar'}
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ padding:'10px 16px', borderBottom:'1px solid #f3f4f6', display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <input
            type="text"
            placeholder={lang==='en' ? 'Search name, role, email...' : 'Buscar nombre, cargo, correo...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex:1, minWidth:180, padding:'6px 11px', border:'1.5px solid #e5e7eb', borderRadius:7, fontSize:'.8rem', fontFamily:'inherit', outline:'none' }}
          />
          {[
            { id:'all',      label: lang==='en' ? 'All' : 'Todos',          count: groupList.length },
            { id:'pending',  label: lang==='en' ? '⏳ Pending' : '⏳ Pendientes', count: pendingCount },
            { id:'answered', label: lang==='en' ? '✅ Answered' : '✅ Respondieron', count: answeredCount },
          ].map(f => (
            <button key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                padding:'5px 12px', border:`1.5px solid ${filter===f.id ? color : '#e5e7eb'}`,
                background: filter===f.id ? color : '#fff',
                color: filter===f.id ? '#fff' : '#6b7280',
                borderRadius:7, fontSize:'.76rem', fontWeight:600,
                cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap',
              }}
            >
              {f.label} ({f.count})
            </button>
          ))}
          <span style={{ marginLeft:'auto', fontSize:'.75rem', color:'#9ca3af' }}>{filtered.length} {lang==='en'?'people':'personas'}</span>
        </div>

        {/* Tabla */}
        <div style={{ overflowX:'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width:28 }}></th>
                {selGroup === 'TODOS' && <th>{lang==='en'?'Group':'Grupo'}</th>}
                <th>{lang==='en'?'Name':'Nombre'}</th>
                <th>{lang==='en'?'Position':'Cargo'}</th>
                <th>{lang==='en'?'Country':'País'}</th>
                <th>{lang==='en'?'Email':'Correo'}</th>
                <th style={{ textAlign:'center', width:120 }}>{lang==='en'?'Status':'Estado'}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={selGroup==='TODOS' ? 7 : 6} style={{ textAlign:'center', padding:32, color:'#9ca3af', fontStyle:'italic', fontSize:'.85rem' }}>
                    {lang==='en' ? 'No results' : 'Sin resultados'}
                  </td>
                </tr>
              ) : filtered.map((e, i) => {
                const nombre = (e.nombre || '').split(' ').slice(0,3)
                  .map(w => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : '').join(' ')
                const cargo = e.cargo ? e.cargo[0].toUpperCase() + e.cargo.slice(1).toLowerCase() : ''
                return (
                  <tr key={i}>
                    <td style={{ textAlign:'center', fontSize:'.9rem' }}>{e.answered ? '✅' : '⏳'}</td>
                    {selGroup === 'TODOS' && (
                      <td>
                        <span style={{
                          display:'inline-block', padding:'2px 8px', borderRadius:12,
                          fontSize:'.68rem', fontWeight:700,
                          background: PART_COLORS[e.grupo] + '20',
                          color: PART_COLORS[e.grupo] || '#6b7280',
                          border: `1px solid ${PART_COLORS[e.grupo]}40`,
                        }}>{e.grupo}</span>
                      </td>
                    )}
                    <td style={{ fontWeight:500, fontSize:'.82rem' }}>{nombre}</td>
                    <td style={{ fontSize:'.78rem', color:'#6b7280', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={cargo}>{cargo}</td>
                    <td style={{ fontSize:'.78rem' }}>{e.pais}</td>
                    <td style={{ fontFamily:'DM Mono, monospace', fontSize:'.72rem', color:'#6b7280' }}>{(e.email||'').toLowerCase()}</td>
                    <td style={{ textAlign:'center' }}>
                      <span style={{
                        display:'inline-flex', alignItems:'center', gap:4,
                        padding:'3px 9px', borderRadius:20, fontSize:'.72rem', fontWeight:600,
                        background: e.answered ? '#f0fdf4' : '#fff7ed',
                        color:       e.answered ? '#16a34a' : '#d97706',
                        border:`1px solid ${e.answered ? '#bbf7d0' : '#fed7aa'}`,
                      }}>
                        {e.answered ? (lang==='en'?'✓ Answered':'✓ Respondió') : (lang==='en'?'Pending':'Pendiente')}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}



// ── Vista: Participación por C-Level (v1.3) ──────────────────
function downloadCSV(data, filename) {
  const BOM = '\uFEFF'
  const headers = ['C-Level','Área','Nombre','Cargo','País','Correo','Grupo','Estado']
  const rows = data.map(e => [
    e.clevel || 'Sin C-Level',
    (e.clevel || '').split('/')[1] || '',
    e.nombre || '',
    e.cargo  || '',
    e.pais   || '',
    (e.email || '').toLowerCase(),
    e.grupo  || '',
    e.answered ? 'Respondió' : 'Pendiente',
  ])
  const csv = BOM + [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// Paleta de colores para los C-Levels
const CLEVEL_PALETTE = [
  '#C00000','#E26B0A','#4472C4','#70AD47','#7B2D8B',
  '#2E75B6','#F79646','#1F3864','#5B9BD5','#9E48C6',
  '#2D7A3A','#D97706','#0EA5E9','#DC2626',
]

function CLevelView({ rows, employees, clevels, lang, loading }) {
  const [selCLevel, setSelCLevel] = useState('TODOS')
  const [search,    setSearch]    = useState('')
  const [filter,    setFilter]    = useState('all')

  // Normalizar el mapa de C-Levels
  const clevelMap = clevels || {}

  // Enriquecer empleados con su C-Level
  const enriched = (employees || []).map(e => ({
    ...e,
    clevel: clevelMap[(e.email || '').toLowerCase().trim()] || 'Sin C-Level asignado',
    answered: new Set((rows||[]).map(r=>(r.email||'').toLowerCase().trim()))
              .has((e.email||'').toLowerCase().trim()),
  }))

  const respondedSet = new Set((rows||[]).map(r=>(r.email||'').toLowerCase().trim()))

  // Lista de C-Levels únicos ordenados
  const clevelList = ['TODOS', ...Array.from(new Set(enriched.map(e => e.clevel))).sort()]

  // Colores asignados
  const clevelColors = {}
  clevelList.filter(c => c !== 'TODOS').forEach((c, i) => {
    clevelColors[c] = CLEVEL_PALETTE[i % CLEVEL_PALETTE.length]
  })
  clevelColors['TODOS']               = '#1a5c2a'
  clevelColors['Sin C-Level asignado'] = '#9ca3af'

  const color = clevelColors[selCLevel] || '#1a5c2a'

  // Stats por C-Level
  const stats = clevelList.map(cl => {
    const emps = cl === 'TODOS' ? enriched : enriched.filter(e => e.clevel === cl)
    const resp = emps.filter(e => e.answered).length
    const pct  = emps.length > 0 ? +(resp / emps.length * 100).toFixed(1) : 0
    // Extraer nombre y área del C-Level (formato "NOMBRE/AREA")
    const parts = cl.split('/')
    const nombre = parts[0]?.trim() || cl
    const area   = parts[1]?.trim() || ''
    return { cl, nombre, area, total: emps.length, resp, pct }
  })

  const selStat = stats.find(s => s.cl === selCLevel) || { total:0, resp:0, pct:0 }

  // Lista filtrada por C-Level seleccionado
  const baseList = selCLevel === 'TODOS'
    ? enriched
    : enriched.filter(e => e.clevel === selCLevel)

  const sorted = [...baseList].sort((a,b) => {
    if (a.answered !== b.answered) return a.answered ? 1 : -1
    if (selCLevel === 'TODOS' && a.clevel !== b.clevel) return a.clevel.localeCompare(b.clevel)
    return (a.nombre||'').localeCompare(b.nombre||'')
  })

  const filtered = sorted.filter(e => {
    if (filter === 'answered' && !e.answered) return false
    if (filter === 'pending'  &&  e.answered) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (e.nombre ||'').toLowerCase().includes(q) ||
             (e.cargo  ||'').toLowerCase().includes(q) ||
             (e.email  ||'').toLowerCase().includes(q) ||
             (e.pais   ||'').toLowerCase().includes(q) ||
             (e.clevel ||'').toLowerCase().includes(q)
    }
    return true
  })

  const pendingCount  = baseList.filter(e => !e.answered).length
  const answeredCount = baseList.filter(e =>  e.answered).length

  const handleDownload = () => {
    const label = selCLevel === 'TODOS' ? 'todos' : selCLevel.split('/')[0].replace(/\s+/g,'-').toLowerCase()
    downloadCSV(filtered, `participacion-clevel-${label}-${new Date().toISOString().slice(0,10)}.csv`)
  }

  // Nombre corto para los chips
  const shortName = cl => {
    if (cl === 'TODOS') return lang === 'en' ? 'ALL' : 'TODOS'
    return cl.split('/')[0]?.split(' ').slice(0,2).join(' ') || cl
  }

  return (
    <div>
      {/* Resumen — tabla de todos los C-Levels */}
      <div className="card card-pad" style={{ marginBottom:20 }}>
        <div className="section-title">{lang==='en' ? 'Summary by C-Level' : 'Resumen por C-Level'}</div>
        <div style={{ overflowX:'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{lang==='en' ? 'C-Level' : 'C-Level'}</th>
                <th>{lang==='en' ? 'Area' : 'Área'}</th>
                <th style={{ textAlign:'center' }}>{lang==='en' ? 'Responded' : 'Respondieron'}</th>
                <th style={{ textAlign:'center' }}>{lang==='en' ? 'Pending' : 'Pendientes'}</th>
                <th style={{ textAlign:'center' }}>{lang==='en' ? 'Total' : 'Total'}</th>
                <th style={{ width:180 }}>{lang==='en' ? 'Progress' : 'Progreso'}</th>
                <th style={{ textAlign:'center' }}>%</th>
              </tr>
            </thead>
            <tbody>
              {stats.filter(s => s.cl !== 'TODOS').map(({ cl, nombre, area, total, resp, pct }) => (
                <tr key={cl}
                  onClick={() => { setSelCLevel(cl); setSearch(''); setFilter('all') }}
                  style={{ cursor:'pointer', background: selCLevel===cl ? clevelColors[cl]+'12' : undefined }}
                >
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:10, height:10, borderRadius:'50%', background: clevelColors[cl], flexShrink:0 }} />
                      <span style={{ fontWeight:600, fontSize:'.82rem' }}>{nombre}</span>
                    </div>
                  </td>
                  <td style={{ fontSize:'.78rem', color:'#6b7280' }}>{area}</td>
                  <td style={{ textAlign:'center', color:'#16a34a', fontWeight:600, fontFamily:'DM Mono, monospace' }}>{resp}</td>
                  <td style={{ textAlign:'center', color:'#d97706', fontWeight:600, fontFamily:'DM Mono, monospace' }}>{total - resp}</td>
                  <td style={{ textAlign:'center', fontFamily:'DM Mono, monospace', color:'#6b7280' }}>{total}</td>
                  <td>
                    <div style={{ height:6, background:'#f3f4f6', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background: clevelColors[cl], borderRadius:3, transition:'width .4s' }} />
                    </div>
                  </td>
                  <td style={{ textAlign:'center', fontFamily:'DM Mono, monospace', fontWeight:700, color: clevelColors[cl] }}>{pct}%</td>
                </tr>
              ))}
              {/* Fila total */}
              {(() => { const t = stats.find(s=>s.cl==='TODOS'); return t ? (
                <tr style={{ background:'#f8fbf9', fontWeight:700, borderTop:'2px solid #e5e7eb' }}>
                  <td colSpan={2} style={{ fontWeight:700 }}>TOTAL</td>
                  <td style={{ textAlign:'center', color:'#16a34a', fontFamily:'DM Mono, monospace', fontWeight:700 }}>{t.resp}</td>
                  <td style={{ textAlign:'center', color:'#d97706', fontFamily:'DM Mono, monospace', fontWeight:700 }}>{t.total - t.resp}</td>
                  <td style={{ textAlign:'center', fontFamily:'DM Mono, monospace', fontWeight:700 }}>{t.total}</td>
                  <td>
                    <div style={{ height:6, background:'#f3f4f6', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${t.pct}%`, background:'#1a5c2a', borderRadius:3 }} />
                    </div>
                  </td>
                  <td style={{ textAlign:'center', fontFamily:'DM Mono, monospace', fontWeight:800, color:'#1a5c2a' }}>{t.pct}%</td>
                </tr>
              ) : null })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detalle del C-Level seleccionado */}
      <div className="card">
        {/* Header */}
        <div style={{ background: color, color:'#fff', padding:'14px 20px', borderRadius:'12px 12px 0 0', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
          <div>
            <div style={{ fontSize:'.68rem', opacity:.7, textTransform:'uppercase', letterSpacing:'.4px', marginBottom:2 }}>
              {lang==='en' ? 'Detail' : 'Detalle'}
            </div>
            <div style={{ fontSize:'.95rem', fontWeight:700 }}>
              {selCLevel === 'TODOS' ? (lang==='en' ? 'All C-Levels' : 'Todos los C-Levels') : selCLevel.split('/')[0]}
              {selCLevel !== 'TODOS' && selCLevel.includes('/') && (
                <span style={{ fontSize:'.75rem', opacity:.7, marginLeft:8 }}>/ {selCLevel.split('/')[1]}</span>
              )}
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            {loading && <div className="spinner" style={{ width:14, height:14, borderWidth:2, borderTopColor:'#fff', borderColor:'rgba(255,255,255,.3)' }} />}
            <div style={{ textAlign:'right' }}>
              <div style={{ fontFamily:'DM Mono, monospace', fontSize:'1.5rem', fontWeight:800 }}>{selStat.pct}%</div>
              <div style={{ fontSize:'.7rem', opacity:.7 }}>{selStat.resp} {lang==='en'?'of':'de'} {selStat.total} {lang==='en'?'people':'personas'}</div>
            </div>
            {/* Botón seleccionar todos */}
            <button onClick={() => { setSelCLevel('TODOS'); setSearch(''); setFilter('all') }}
              style={{ background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.35)', color:'#fff', borderRadius:7, padding:'6px 12px', fontSize:'.75rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
              {lang==='en' ? 'All' : 'Todos'}
            </button>
            {/* Botón descargar */}
            <button onClick={handleDownload}
              style={{ background:'rgba(255,255,255,.2)', border:'1px solid rgba(255,255,255,.4)', color:'#fff', borderRadius:7, padding:'7px 14px', fontSize:'.78rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.35)'}
              onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,.2)'}
            >
              📥 {lang==='en' ? 'Download' : 'Descargar'}
            </button>
          </div>
        </div>

        {/* Chips C-Level para filtrar */}
        <div style={{ padding:'10px 16px', borderBottom:'1px solid #f3f4f6', display:'flex', gap:6, flexWrap:'wrap' }}>
          {clevelList.map(cl => (
            <button key={cl}
              onClick={() => { setSelCLevel(cl); setSearch(''); setFilter('all') }}
              style={{
                padding:'4px 10px', border:`1.5px solid ${selCLevel===cl ? clevelColors[cl] : '#e5e7eb'}`,
                background: selCLevel===cl ? clevelColors[cl] : '#fff',
                color: selCLevel===cl ? '#fff' : '#6b7280',
                borderRadius:20, fontSize:'.72rem', fontWeight:600,
                cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap',
              }}
            >{shortName(cl)}</button>
          ))}
        </div>

        {/* Filtros */}
        <div style={{ padding:'8px 16px', borderBottom:'1px solid #f3f4f6', display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <input type="text"
            placeholder={lang==='en' ? 'Search name, role, email...' : 'Buscar nombre, cargo, correo...'}
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex:1, minWidth:180, padding:'6px 11px', border:'1.5px solid #e5e7eb', borderRadius:7, fontSize:'.8rem', fontFamily:'inherit', outline:'none' }}
          />
          {[
            { id:'all',      label: lang==='en'?'All':'Todos',                count: baseList.length },
            { id:'pending',  label: lang==='en'?'⏳ Pending':'⏳ Pendientes', count: pendingCount },
            { id:'answered', label: lang==='en'?'✅ Answered':'✅ Respondieron', count: answeredCount },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              style={{ padding:'5px 12px', border:`1.5px solid ${filter===f.id ? color : '#e5e7eb'}`, background: filter===f.id ? color : '#fff', color: filter===f.id ? '#fff' : '#6b7280', borderRadius:7, fontSize:'.76rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
              {f.label} ({f.count})
            </button>
          ))}
          <span style={{ marginLeft:'auto', fontSize:'.75rem', color:'#9ca3af' }}>{filtered.length} {lang==='en'?'people':'personas'}</span>
        </div>

        {/* Tabla detalle */}
        <div style={{ overflowX:'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width:28 }}></th>
                {selCLevel === 'TODOS' && <th>{lang==='en'?'C-Level':'C-Level'}</th>}
                <th>{lang==='en'?'Name':'Nombre'}</th>
                <th>{lang==='en'?'Position':'Cargo'}</th>
                <th>{lang==='en'?'Country':'País'}</th>
                <th>{lang==='en'?'Group':'Grupo'}</th>
                <th>{lang==='en'?'Email':'Correo'}</th>
                <th style={{ textAlign:'center', width:120 }}>{lang==='en'?'Status':'Estado'}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={selCLevel==='TODOS' ? 8 : 7} style={{ textAlign:'center', padding:32, color:'#9ca3af', fontStyle:'italic', fontSize:'.85rem' }}>
                    {lang==='en' ? 'No results' : 'Sin resultados'}
                  </td>
                </tr>
              ) : filtered.map((e, i) => {
                const nombre = (e.nombre||'').split(' ').slice(0,3).map(w => w ? w[0].toUpperCase()+w.slice(1).toLowerCase() : '').join(' ')
                const cargo  = e.cargo ? e.cargo[0].toUpperCase()+e.cargo.slice(1).toLowerCase() : ''
                const clvColor = clevelColors[e.clevel] || '#9ca3af'
                return (
                  <tr key={i}>
                    <td style={{ textAlign:'center', fontSize:'.9rem' }}>{e.answered ? '✅' : '⏳'}</td>
                    {selCLevel === 'TODOS' && (
                      <td>
                        <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:12, fontSize:'.68rem', fontWeight:700, background: clvColor+'18', color: clvColor, border:`1px solid ${clvColor}35`, whiteSpace:'nowrap' }}>
                          {e.clevel.split('/')[0]?.split(' ').slice(0,2).join(' ')}
                        </span>
                      </td>
                    )}
                    <td style={{ fontWeight:500, fontSize:'.82rem' }}>{nombre}</td>
                    <td style={{ fontSize:'.78rem', color:'#6b7280', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={cargo}>{cargo}</td>
                    <td style={{ fontSize:'.78rem' }}>{e.pais}</td>
                    <td><span style={{ fontFamily:'DM Mono, monospace', fontSize:'.7rem', background:'#f3f4f6', padding:'2px 7px', borderRadius:4 }}>{e.grupo}</span></td>
                    <td style={{ fontFamily:'DM Mono, monospace', fontSize:'.72rem', color:'#6b7280' }}>{(e.email||'').toLowerCase()}</td>
                    <td style={{ textAlign:'center' }}>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 9px', borderRadius:20, fontSize:'.72rem', fontWeight:600, background: e.answered?'#f0fdf4':'#fff7ed', color: e.answered?'#16a34a':'#d97706', border:`1px solid ${e.answered?'#bbf7d0':'#fed7aa'}` }}>
                        {e.answered ? (lang==='en'?'✓ Answered':'✓ Respondió') : (lang==='en'?'Pending':'Pendiente')}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── ROOT APP ────────────────────────────────────────────────
export default function App() {
  const [view,    setView]    = useState('overview')
  const [radarSelectedDim,   setRadarSelectedDim]   = useState(null)
  const [radarSelectedPilar, setRadarSelectedPilar] = useState(null)
  const [lang,    setLang]    = useState(() => navigator.language?.startsWith('en') ? 'en' : 'es')
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)

  const questions = questionsData
  const employees = employeesData

  const loadData = async () => {
    setLoading(true); setError(null)
    try {
      const data = await fetchAllResponses()
      setRows(data)
      setLastRefresh(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const scores = useMemo(() =>
    rows.length ? calcScores(rows, questions, employees) : null,
    [rows, questions, employees]
  )

  const nav = [
    { id: 'overview',      icon: '📊', label: lang === 'en' ? 'Overview'       : 'Resumen General'    },
    { id: 'radar',         icon: '🕸️',  label: lang === 'en' ? 'Radar Chart'    : 'Gráfico Radar'     },
    { id: 'dimensions',    icon: '📋', label: lang === 'en' ? 'Dimensions'     : 'Dimensiones'       },
    { id: 'byCountry',     icon: '🌍', label: lang === 'en' ? 'By Country'     : 'Por País'          },
    { id: 'byGroup',       icon: '👥', label: lang === 'en' ? 'By Group'       : 'Por Grupo'         },
    { id: 'participation', icon: '✅', label: lang === 'en' ? 'Participation'  : 'Participación'     },
    { id: 'byclevel',      icon: '🏢', label: lang === 'en' ? 'By C-Level'     : 'Por C-Level'       },
  ]

  const pageTitle = {
    overview:   lang === 'en' ? 'Overview'            : 'Resumen General',
    radar:      lang === 'en' ? 'Radar Chart'         : 'Gráfico Radar',
    dimensions: lang === 'en' ? 'All Dimensions'      : 'Todas las Dimensiones',
    byCountry:  lang === 'en' ? 'Analysis by Country' : 'Análisis por País',
    byGroup:       lang === 'en' ? 'Analysis by Group'   : 'Análisis por Grupo',
    participation: lang === 'en' ? 'Participation Detail' : 'Detalle de Participación',
    byclevel:      lang === 'en' ? 'Participation by C-Level' : 'Participación por C-Level',
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="hf-badge">HF</div>
          <h1>{lang === 'en' ? 'Data Maturity\nDashboard' : 'Dashboard\nMadurez de Datos'}</h1>
          <p>Hortifrut · {new Date().getFullYear()}</p>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section-label">{lang === 'en' ? 'Navigation' : 'Navegación'}</div>
          {nav.map(n => (
            <button key={n.id} className={`nav-item ${view === n.id ? 'active' : ''}`}
              onClick={() => setView(n.id)}>
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </button>
          ))}

          <div className="nav-section-label" style={{ marginTop: 20 }}>{lang === 'en' ? 'Language' : 'Idioma'}</div>
          <div style={{ display: 'flex', gap: 6, padding: '4px 12px' }}>
            {['es','en'].map(l => (
              <button key={l}
                onClick={() => setLang(l)}
                style={{
                  background: lang === l ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.08)',
                  border: '1px solid rgba(255,255,255,.2)',
                  color: '#fff', borderRadius: 6, padding: '4px 12px',
                  fontSize: '.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
                }}>
                {l === 'es' ? '🇪🇸 ES' : '🇬🇧 EN'}
              </button>
            ))}
          </div>
        </nav>
        <div className="sidebar-footer">
          {lastRefresh && (
            <div>{lang === 'en' ? 'Updated' : 'Actualizado'}: {lastRefresh.toLocaleTimeString()}</div>
          )}
          <div style={{ marginTop:6, opacity:.6, fontSize:'.68rem' }}>
            v1.0 · Hortifrut Data Maturity
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        <div className="page-header">
          <div>
            <h2>{pageTitle[view]}</h2>
            <p>
              {scores
                ? `${scores.totalResponses} ${lang === 'en' ? 'of' : 'de'} ${scores.totalParticipants} ${lang === 'en' ? 'people' : 'personas'} · ${scores.totalParticipants > 0 ? (scores.totalResponses / scores.totalParticipants * 100).toFixed(2) : 0}% ${lang === 'en' ? 'participation' : 'participación'}`
                : lang === 'en' ? 'Loading data…' : 'Cargando datos…'}
            </p>
          </div>
          <div className="header-actions">
            <button className="btn btn-ghost" onClick={loadData} disabled={loading}>
              {loading ? '⏳' : '🔄'} {lang === 'en' ? 'Refresh' : 'Actualizar'}
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-warn">
            ⚠️ {lang === 'en' ? 'Could not load data:' : 'No se pudo cargar los datos:'} {error}
            <br />
            <small>{lang === 'en' ? 'Make sure VITE_SHEET_URL is configured correctly.' : 'Asegúrate que VITE_SHEET_URL esté configurada correctamente.'}</small>
          </div>
        )}

        {loading ? (
          <div className="loading-center">
            <div className="spinner" />
            <p>{lang === 'en' ? 'Reading Google Sheets…' : 'Leyendo Google Sheets…'}</p>
          </div>
        ) : (
          <>
            {view === 'overview'   && <OverviewView scores={scores} rows={rows} questions={questions} lang={lang} />}
            {view === 'radar'      && (
              <div className="card card-pad">
                <div className="section-title">{lang === 'en' ? 'Company Level — All Dimensions' : 'Nivel Compañía — Todas las Dimensiones'}</div>
                <div className="radar-wrap" style={{ padding: '20px 0' }}>
                  {scores
                    ? <>
                        <RadarChart dimensions={scores.dimensions} size={580} lang={lang}
                          selectedDim={radarSelectedDim}     onSelectDim={setRadarSelectedDim}
                          selectedPilar={radarSelectedPilar} onSelectPilar={(p) => { setRadarSelectedPilar(p); setRadarSelectedDim(null) }} />
                        <DimensionDetail dimName={radarSelectedDim} rows={rows} questions={questions}
                          lang={lang} onClose={() => setRadarSelectedDim(null)} />
                      </>
                    : <div className="loading-center"><p>{lang === 'en' ? 'No data' : 'Sin datos'}</p></div>
                  }
                </div>
              </div>
            )}
            {view === 'dimensions' && <DimensionsView scores={scores} lang={lang} />}
            {view === 'byCountry'  && <FilteredView rows={rows} questions={questions} employees={employees} lang={lang} />}
            {view === 'byGroup'    && <GroupsView rows={rows} questions={questions} employees={employees} lang={lang} />}
          </>
        )}
        {/* Participación no necesita esperar al Sheet — muestra empleados siempre */}
        {view === 'participation' && <ParticipationView rows={rows} employees={employees} lang={lang} loading={loading} />}
        {view === 'byclevel'      && <CLevelView rows={rows} employees={employees} clevels={clevelsData} lang={lang} loading={loading} />}
      </main>
    </div>
  )
}
