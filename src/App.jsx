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
          sub={`${lang === 'en' ? 'of' : 'de'} ${scores.totalParticipants} ${lang === 'en' ? 'participants' : 'participantes'}`}
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
                {maturityLabel(scores.global, lang)} · {scores.totalResponses} {lang === 'en' ? 'responses' : 'respuestas'}
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
              {selGroup} — {GROUP_NAMES[selGroup] || selGroup}
            </div>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '2.2rem', fontWeight: 800, color: scoreColor(scores.global) }}>
                {scores.global?.toFixed(2)}
              </span>
              <div style={{ fontSize: '.8rem', color: '#6b7280', marginTop: 2 }}>
                {maturityLabel(scores.global, lang)} · {scores.totalResponses} {lang === 'en' ? 'responses' : 'respuestas'}
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
    { id: 'overview',   icon: '📊', label: lang === 'en' ? 'Overview'    : 'Resumen General' },
    { id: 'radar',      icon: '🕸️',  label: lang === 'en' ? 'Radar Chart' : 'Gráfico Radar'  },
    { id: 'dimensions', icon: '📋', label: lang === 'en' ? 'Dimensions'  : 'Dimensiones'    },
    { id: 'byCountry',  icon: '🌍', label: lang === 'en' ? 'By Country'  : 'Por País'       },
    { id: 'byGroup',    icon: '👥', label: lang === 'en' ? 'By Group'    : 'Por Grupo'      },
  ]

  const pageTitle = {
    overview:   lang === 'en' ? 'Overview'            : 'Resumen General',
    radar:      lang === 'en' ? 'Radar Chart'         : 'Gráfico Radar',
    dimensions: lang === 'en' ? 'All Dimensions'      : 'Todas las Dimensiones',
    byCountry:  lang === 'en' ? 'Analysis by Country' : 'Análisis por País',
    byGroup:    lang === 'en' ? 'Analysis by Group'   : 'Análisis por Grupo',
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
                ? `${scores.totalResponses} ${lang === 'en' ? 'responses' : 'respuestas'} · ${scores.totalParticipants > 0 ? (scores.totalResponses / scores.totalParticipants * 100).toFixed(2) : 0}% ${lang === 'en' ? 'participation' : 'participación'}`
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
      </main>
    </div>
  )
}
