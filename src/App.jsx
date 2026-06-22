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

function ParticipationView({ rows, employees, lang, loading = false }) {
  const [selGroup,  setSelGroup]  = useState('G1')
  const [search,    setSearch]    = useState('')
  const [filterSt,  setFilterSt]  = useState('all') // all | answered | pending

  // Respondentes — normalizar emails
  const respondedEmails = useMemo(() =>
    new Set(rows.map(r => (r.email || '').toLowerCase().trim())),
    [rows]
  )

  // Empleados del grupo seleccionado
  const groupEmps = useMemo(() =>
    employees
      .filter(e => e.grupo === selGroup)
      .map(e => ({
        ...e,
        answered: respondedEmails.has((e.email || '').toLowerCase().trim()),
      }))
      .sort((a, b) => {
        // Respondidos al fondo, pendientes arriba
        if (a.answered !== b.answered) return a.answered ? 1 : -1
        return a.nombre.localeCompare(b.nombre)
      }),
    [employees, selGroup, respondedEmails]
  )

  // Filtrar por búsqueda y estado
  const filtered = useMemo(() => {
    let list = groupEmps
    if (filterSt === 'answered') list = list.filter(e => e.answered)
    if (filterSt === 'pending')  list = list.filter(e => !e.answered)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(e =>
        e.nombre.toLowerCase().includes(q) ||
        e.cargo.toLowerCase().includes(q)  ||
        e.email.toLowerCase().includes(q)  ||
        e.pais.toLowerCase().includes(q)
      )
    }
    return list
  }, [groupEmps, filterSt, search])

  // Stats de todos los grupos
  const allStats = useMemo(() =>
    GROUP_ORDER.map(g => {
      const emps = employees.filter(e => e.grupo === g)
      const resp = emps.filter(e => respondedEmails.has((e.email||'').toLowerCase().trim())).length
      return { g, total: emps.length, resp, pct: emps.length ? +(resp/emps.length*100).toFixed(1) : 0 }
    }),
    [employees, respondedEmails]
  )

  const selStats = allStats.find(s => s.g === selGroup) || { total:0, resp:0, pct:0 }
  const color    = GROUP_COLORS_HEX[selGroup] || '#1a5c2a'

  return (
    <div>
      {/* KPIs globales */}
      <div className="kpi-grid" style={{ marginBottom:20 }}>
        {allStats.map(({ g, total, resp, pct }) => (
          <div key={g}
            onClick={() => { setSelGroup(g); setSearch(''); setFilterSt('all') }}
            style={{
              background: selGroup === g ? color : '#fff',
              border: `2px solid ${selGroup === g ? color : '#e5e7eb'}`,
              borderRadius: 10, padding:'12px 14px', cursor:'pointer',
              transition:'all .15s',
            }}
          >
            <div style={{
              fontSize:'.7rem', fontWeight:700, letterSpacing:'.4px',
              color: selGroup === g ? 'rgba(255,255,255,.75)' : '#6b7280',
              marginBottom:4,
            }}>{g}</div>
            <div style={{
              fontFamily:'DM Mono, monospace', fontSize:'1.4rem', fontWeight:800,
              color: selGroup === g ? '#fff' : color,
              lineHeight:1,
            }}>{pct}%</div>
            <div style={{
              fontSize:'.7rem', color: selGroup === g ? 'rgba(255,255,255,.65)' : '#9ca3af',
              marginTop:3,
            }}>{resp} / {total}</div>
            <div style={{
              marginTop:6, height:3,
              background: selGroup === g ? 'rgba(255,255,255,.25)' : '#f3f4f6',
              borderRadius:2, overflow:'hidden',
            }}>
              <div style={{
                height:'100%', width:`${pct}%`,
                background: selGroup === g ? 'rgba(255,255,255,.7)' : color,
                borderRadius:2, transition:'width .4s',
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Panel del grupo seleccionado */}
      <div className="card">
        {/* Header del panel */}
        <div style={{
          background: color, color:'#fff',
          padding:'16px 20px', borderRadius:'12px 12px 0 0',
          display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12,
        }}>
          <div>
            <div style={{ fontSize:'.72rem', fontWeight:600, opacity:.7, letterSpacing:'.4px', textTransform:'uppercase' }}>
              {selGroup}
            </div>
            <div style={{ fontSize:'1rem', fontWeight:700 }}>
              {GNAMES[selGroup]}
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontFamily:'DM Mono, monospace', fontSize:'1.6rem', fontWeight:800 }}>
                {selStats.pct}%
              </div>
              <div style={{ fontSize:'.7rem', opacity:.7 }}>
                {selStats.resp} {lang==='en'?'of':'de'} {selStats.total} {lang==='en'?'people':'personas'}
              </div>
            </div>
            {/* Mini barra */}
            <div style={{ width:100, height:6, background:'rgba(255,255,255,.25)', borderRadius:3, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${selStats.pct}%`, background:'rgba(255,255,255,.8)', borderRadius:3 }} />
            </div>
          </div>
        </div>

        {/* Aviso cargando respuestas */}
        {loading && (
          <div style={{
            padding:'8px 20px', background:'#fffbeb',
            borderBottom:'1px solid #fde68a',
            fontSize:'.78rem', color:'#92400e', display:'flex', alignItems:'center', gap:8,
          }}>
            <div className="spinner" style={{ width:14, height:14, borderWidth:2 }} />
            {lang === 'en' ? 'Loading responses from Google Sheets…' : 'Cargando respuestas desde Google Sheets…'}
          </div>
        )}
        {/* Filtros */}
        <div style={{
          padding:'12px 20px', borderBottom:'1px solid #f3f4f6',
          display:'flex', gap:10, flexWrap:'wrap', alignItems:'center',
        }}>
          <input
            type="text"
            placeholder={lang==='en' ? 'Search by name, role, email...' : 'Buscar por nombre, cargo, correo...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex:1, minWidth:200, padding:'7px 12px',
              border:'1.5px solid #e5e7eb', borderRadius:7,
              fontSize:'.82rem', fontFamily:'inherit', outline:'none',
            }}
            onFocus={e => e.target.style.borderColor = color}
            onBlur={e  => e.target.style.borderColor = '#e5e7eb'}
          />
          {['all','pending','answered'].map(f => (
            <button key={f}
              onClick={() => setFilterSt(f)}
              style={{
                padding:'6px 14px', border:'1.5px solid',
                borderColor: filterSt===f ? color : '#e5e7eb',
                background: filterSt===f ? color : '#fff',
                color: filterSt===f ? '#fff' : '#6b7280',
                borderRadius:7, fontSize:'.78rem', fontWeight:600,
                cursor:'pointer', fontFamily:'inherit', transition:'all .15s',
              }}
            >
              {f==='all'
                ? (lang==='en' ? 'All' : 'Todos')
                : f==='pending'
                ? `⏳ ${lang==='en' ? 'Pending' : 'Pendientes'} (${groupEmps.filter(e=>!e.answered).length})`
                : `✅ ${lang==='en' ? 'Answered' : 'Respondieron'} (${groupEmps.filter(e=>e.answered).length})`
              }
            </button>
          ))}
          <div style={{ marginLeft:'auto', fontSize:'.78rem', color:'#9ca3af' }}>
            {filtered.length} {lang==='en'?'people':'personas'}
          </div>
        </div>

        {/* Tabla */}
        <div style={{ overflowX:'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width:32 }}></th>
                <th>{lang==='en'?'Name':'Nombre'}</th>
                <th>{lang==='en'?'Position':'Cargo'}</th>
                <th>{lang==='en'?'Country':'País'}</th>
                <th>{lang==='en'?'Email':'Correo'}</th>
                <th style={{ textAlign:'center' }}>{lang==='en'?'Status':'Estado'}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign:'center', color:'#9ca3af', padding:'32px', fontStyle:'italic' }}>
                    {lang==='en' ? 'No results found' : 'Sin resultados'}
                  </td>
                </tr>
              ) : filtered.map((e, i) => (
                <tr key={i} style={{ opacity: e.answered ? 1 : 1 }}>
                  <td style={{ textAlign:'center', fontSize:'1rem' }}>
                    {e.answered ? '✅' : '⏳'}
                  </td>
                  <td style={{ fontWeight:500, fontSize:'.82rem' }}>
                    {e.nombre.split(' ').slice(0,3).map(w =>
                      w.charAt(0) + w.slice(1).toLowerCase()
                    ).join(' ')}
                  </td>
                  <td style={{ fontSize:'.78rem', color:'#6b7280', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {e.cargo.charAt(0) + e.cargo.slice(1).toLowerCase()}
                  </td>
                  <td style={{ fontSize:'.78rem' }}>{e.pais}</td>
                  <td style={{ fontFamily:'DM Mono, monospace', fontSize:'.72rem', color:'#6b7280' }}>
                    {e.email.toLowerCase()}
                  </td>
                  <td style={{ textAlign:'center' }}>
                    <span style={{
                      display:'inline-flex', alignItems:'center', gap:4,
                      padding:'3px 10px', borderRadius:20, fontSize:'.72rem', fontWeight:600,
                      background: e.answered ? '#f0fdf4' : '#fff7ed',
                      color:       e.answered ? '#16a34a' : '#d97706',
                      border:      `1px solid ${e.answered ? '#bbf7d0' : '#fed7aa'}`,
                    }}>
                      {e.answered
                        ? (lang==='en' ? '✓ Answered' : '✓ Respondió')
                        : (lang==='en' ? '⏳ Pending' : '⏳ Pendiente')}
                    </span>
                  </td>
                </tr>
              ))}
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
  ]

  const pageTitle = {
    overview:   lang === 'en' ? 'Overview'            : 'Resumen General',
    radar:      lang === 'en' ? 'Radar Chart'         : 'Gráfico Radar',
    dimensions: lang === 'en' ? 'All Dimensions'      : 'Todas las Dimensiones',
    byCountry:  lang === 'en' ? 'Analysis by Country' : 'Análisis por País',
    byGroup:       lang === 'en' ? 'Analysis by Group'   : 'Análisis por Grupo',
    participation: lang === 'en' ? 'Participation Detail' : 'Detalle de Participación',
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
      </main>
    </div>
  )
}
