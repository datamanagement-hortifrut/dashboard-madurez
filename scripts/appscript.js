/**
 * GOOGLE APPS SCRIPT — Encuesta Madurez de Datos Hortifrut
 * ─────────────────────────────────────────────────────────
 * Un único script maneja las 11 hojas (una por grupo).
 * La app envía el campo "sheet_name" para indicar en qué hoja guardar.
 *
 * Desplegar como Web App:
 *   1. Extensiones → Apps Script
 *   2. Pega este código y guarda
 *   3. Implementar → Nueva implementación → Aplicación web
 *   4. Ejecutar como: Yo | Acceso: Cualquier usuario
 *   5. Copiar URL → pegarla en .env como VITE_SHEET_URL
 */

const LOCK_TIMEOUT = 10000

// IDs de preguntas por grupo (columnas del sheet después de los fijos)
const QUESTIONS_BY_GROUP = {
  Respuestas_G1:  ['P0201','P0202','P0203','P0204','P0205','P0801','P0802','P0803','P0804','P0805','P0901','P0902','P0903','P0904','P0905','P1601','P1602','P1603','P1604','P1605','P1701','P1702','P1703','P1704','P1705','P1801','P1802','P1803','P1804','P1805','P1901','P1902','P1903','P1904','P1905','P2001','P2002','P2003','P2004','P2005','P2101','P2102','P2103','P2104','P2105','P2201','P2202','P2203','P2204','P2205'],
  Respuestas_G2:  ['P0201','P0202','P0203','P0204','P0205','P0301','P0302','P0303','P0304','P0305','P0401','P0402','P0403','P0404','P0405','P0501','P0502','P0503','P0504','P0505','P0601','P0602','P0603','P0604','P0605','P0701','P0702','P0703','P0704','P0705','P0801','P0802','P0803','P0804','P0805','P0901','P0902','P0903','P0904','P0905','P1201','P1202','P1203','P1204','P1205','P1601','P1602','P1603','P1604','P1605','P1701','P1702','P1703','P1704','P1705','P1801','P1802','P1803','P1804','P1805','P1901','P1902','P1903','P1904','P1905','P2001','P2002','P2003','P2004','P2005','P2101','P2102','P2103','P2104','P2105','P2201','P2202','P2203','P2204','P2205'],
  Respuestas_G3:  ['P0201','P0202','P0203','P0204','P0205','P0301','P0302','P0303','P0304','P0305','P0901','P0902','P0903','P0904','P0905','P1001','P1002','P1003','P1004','P1005','P1101','P1102','P1103','P1104','P1105','P1201','P1202','P1203','P1204','P1205','P1701','P1702','P1703','P1704','P1705','P1901','P1902','P1903','P1904','P1905','P2101','P2102','P2103','P2104','P2105','P2201','P2202','P2203','P2204','P2205'],
  Respuestas_G4:  ['P0201','P0202','P0203','P0204','P0205','P0301','P0302','P0303','P0304','P0305','P0401','P0402','P0403','P0404','P0405','P0501','P0502','P0503','P0504','P0505','P0601','P0602','P0603','P0604','P0605','P0701','P0702','P0703','P0704','P0705','P0801','P0802','P0803','P0804','P0805','P0901','P0902','P0903','P0904','P0905','P1001','P1002','P1003','P1004','P1005','P1101','P1102','P1103','P1104','P1105','P1201','P1202','P1203','P1204','P1205','P1301','P1302','P1303','P1304','P1305','P1401','P1402','P1403','P1404','P1405','P1501','P1502','P1503','P1504','P1505','P1601','P1602','P1603','P1604','P1605','P1701','P1702','P1703','P1704','P1705','P1801','P1802','P1803','P1804','P1805','P1901','P1902','P1903','P1904','P1905','P2001','P2002','P2003','P2004','P2005','P2101','P2102','P2103','P2104','P2105','P2201','P2202','P2203','P2204','P2205'],
  Respuestas_G5:  ['P0301','P0302','P0303','P0304','P0305','P0401','P0402','P0403','P0404','P0405','P0501','P0502','P0503','P0504','P0505','P0701','P0702','P0703','P0704','P0705','P0801','P0802','P0803','P0804','P0805','P1001','P1002','P1003','P1004','P1005','P1101','P1102','P1103','P1104','P1105','P1201','P1202','P1203','P1204','P1205','P1301','P1302','P1303','P1304','P1305','P1401','P1402','P1403','P1404','P1405','P1501','P1502','P1503','P1504','P1505','P1701','P1702','P1703','P1704','P1705'],
  Respuestas_G6:  ['P0301','P0302','P0303','P0304','P0305','P0501','P0502','P0503','P0504','P0505','P0601','P0602','P0603','P0604','P0605','P1001','P1002','P1003','P1004','P1005','P1101','P1102','P1103','P1104','P1105','P1201','P1202','P1203','P1204','P1205','P1301','P1302','P1303','P1304','P1305','P1401','P1402','P1403','P1404','P1405','P2101','P2102','P2103','P2104','P2105','P2201','P2202','P2203','P2204','P2205'],
  Respuestas_G7a: ['P0501','P0502','P0503','P0504','P0505','P1001','P1002','P1003','P1004','P1005','P1101','P1102','P1103','P1104','P1105','P1201','P1202','P1203','P1204','P1205','P1301','P1302','P1303','P1304','P1305','P1401','P1402','P1403','P1404','P1405','P2101','P2102','P2103','P2104','P2105'],
  Respuestas_G7b: ['P0501','P0502','P0503','P0504','P0505','P1101','P1102','P1103','P1104','P1105','P1201','P1202','P1203','P1204','P1205','P1301','P1302','P1303','P1304','P1305','P1401','P1402','P1403','P1404','P1405','P1901','P1902','P1903','P1904','P1905','P2101','P2102','P2103','P2104','P2105'],
  Respuestas_G8b: ['P0301','P0302','P0303','P0304','P0305','P0401','P0402','P0403','P0404','P0405','P0501','P0502','P0503','P0504','P0505','P0601','P0602','P0603','P0604','P0605','P1901','P1902','P1903','P1904','P1905','P2101','P2102','P2103','P2104','P2105'],
  Respuestas_G8c: ['P0301','P0302','P0303','P0304','P0305','P0501','P0502','P0503','P0504','P0505','P0601','P0602','P0603','P0604','P0605','P2101','P2102','P2103','P2104','P2105'],
  Respuestas_G9:  ['P0201','P0202','P0203','P0204','P0205','P0301','P0302','P0303','P0304','P0305','P0401','P0402','P0403','P0404','P0405','P0501','P0502','P0503','P0504','P0505','P0601','P0602','P0603','P0604','P0605','P0701','P0702','P0703','P0704','P0705','P0801','P0802','P0803','P0804','P0805','P1401','P1402','P1403','P1404','P1405','P1501','P1502','P1503','P1504','P1505','P1601','P1602','P1603','P1604','P1605','P1901','P1902','P1903','P1904','P1905','P2001','P2002','P2003','P2004','P2005','P2101','P2102','P2103','P2104','P2105','P2201','P2202','P2203','P2204','P2205'],
}

const FIXED_HEADERS = ['Timestamp','Email','Nombre','Cargo','País','Grupo','Grupo Nombre']

function ensureSheet(sheetName) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet()
  let   sheet = ss.getSheetByName(sheetName)
  if (!sheet) {
    const qIds = QUESTIONS_BY_GROUP[sheetName] || []
    sheet = ss.insertSheet(sheetName)
    const headers = [...FIXED_HEADERS, ...qIds]
    const r = sheet.getRange(1, 1, 1, headers.length)
    r.setValues([headers])
    r.setBackground('#1F3864').setFontColor('#FFFFFF').setFontWeight('bold')
    sheet.setFrozenRows(1)
    sheet.setColumnWidth(1, 160)
    sheet.setColumnWidth(2, 220)
    sheet.setColumnWidth(3, 200)
  }
  return sheet
}

function findRowByEmail(sheet, email) {
  if (!email) return -1
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return -1
  const emails = sheet.getRange(2, 2, lastRow - 1, 1).getValues().flat()
    .map(v => String(v).toLowerCase().trim())
  const idx = emails.indexOf(email.toLowerCase().trim())
  return idx >= 0 ? idx + 2 : -1
}

function doGet(e) {
  const out = ContentService.createTextOutput().setMimeType(ContentService.MimeType.JSON)
  try {
    const action     = e.parameter.action || 'ping'
    const sheetName  = e.parameter.sheet  || ''
    const email      = (e.parameter.email || '').toLowerCase().trim()

    if (action === 'get' && email) {
      // Buscar en todas las hojas si no se especifica una
      const sheetsToSearch = sheetName
        ? [sheetName]
        : Object.keys(QUESTIONS_BY_GROUP)

      for (const sn of sheetsToSearch) {
        const ss    = SpreadsheetApp.getActiveSpreadsheet()
        const sheet = ss.getSheetByName(sn)
        if (!sheet) continue
        const rowIdx = findRowByEmail(sheet, email)
        if (rowIdx < 0) continue

        const qIds  = QUESTIONS_BY_GROUP[sn] || []
        const row   = sheet.getRange(rowIdx, 1, 1, FIXED_HEADERS.length + qIds.length).getValues()[0]
        const answers = {}
        qIds.forEach((id, i) => {
          const v = row[FIXED_HEADERS.length + i]
          if (v && String(v).trim()) answers[id] = String(v).trim()
        })
        out.setContent(JSON.stringify({
          found: true, timestamp: row[0] ? new Date(row[0]).toISOString() : null,
          nombre: row[2], answers,
        }))
        return out
      }
      out.setContent(JSON.stringify({ found: false }))
    } else if (action === 'getAll') {
      // Devuelve todas las filas de una hoja específica
      const sn = e.parameter.sheet || ''
      if (!sn || !QUESTIONS_BY_GROUP[sn]) {
        out.setContent(JSON.stringify({ rows: [] }))
        return out
      }
      const ss    = SpreadsheetApp.getActiveSpreadsheet()
      const sheet = ss.getSheetByName(sn)
      if (!sheet || sheet.getLastRow() < 2) {
        out.setContent(JSON.stringify({ rows: [] }))
        return out
      }
      const qIds   = QUESTIONS_BY_GROUP[sn] || []
      const allCols = FIXED_HEADERS.length + qIds.length
      const data   = sheet.getRange(2, 1, sheet.getLastRow() - 1, allCols).getValues()
      const rows   = data
        .filter(row => row[1]) // tiene email
        .map(row => {
          const answers = {}
          qIds.forEach((id, i) => {
            const v = row[FIXED_HEADERS.length + i]
            if (v && String(v).trim()) answers[id] = String(v).trim()
          })
          return {
            timestamp: row[0] ? new Date(row[0]).toISOString() : null,
            email:     String(row[1]).toLowerCase().trim(),
            nombre:    row[2], cargo: row[3],
            pais:      row[4], grupo: row[5],
            grupo_nombre: row[6],
            answers
          }
        })
      out.setContent(JSON.stringify({ rows }))
    } else {
      out.setContent(JSON.stringify({ status:'ok', sheets: Object.keys(QUESTIONS_BY_GROUP) }))
    }
  } catch(err) {
    out.setContent(JSON.stringify({ found:false, error:err.message }))
  }
  return out
}

function doPost(e) {
  const out = ContentService.createTextOutput().setMimeType(ContentService.MimeType.JSON)
  try {
    const data      = JSON.parse(e.postData.contents)
    const sheetName = data.sheet_name || 'Respuestas_G1'
    const qIds      = QUESTIONS_BY_GROUP[sheetName] || []
    const sheet     = ensureSheet(sheetName)
    const lock      = LockService.getScriptLock()
    lock.waitLock(LOCK_TIMEOUT)

    const existing = findRowByEmail(sheet, data.email)
    const rowIndex = existing > 0 ? existing : sheet.getLastRow() + 1
    const row = [
      data.timestamp, data.email, data.nombre, data.cargo,
      data.pais, data.grupo, data.grupo_nombre,
      ...qIds.map(id => data.answers[id] || ''),
    ]
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row])
    if (existing <= 0 && rowIndex % 2 === 0) {
      sheet.getRange(rowIndex, 1, 1, row.length).setBackground('#F3F4F6')
    }
    lock.releaseLock()
    out.setContent(JSON.stringify({ status:'ok', row:rowIndex, updated: existing > 0 }))
  } catch(err) {
    out.setContent(JSON.stringify({ status:'error', message:err.message }))
  }
  return out
}
