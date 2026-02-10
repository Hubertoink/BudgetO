import { BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { ensureExportsBaseDir } from './exportsDir'
import { getCashCheckById } from '../repositories/cashChecks'
import { getActiveOrganization } from '../db/database'

function esc(v: any): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function euro(n: number) {
  try {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0)
  } catch {
    return `${Number(n) || 0} EUR`
  }
}

function safeIsoDate(s: string): string {
  const v = String(s || '').slice(0, 10)
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : 'unknown'
}

function prepareExportPath(prefix: string, dateISO: string): string {
  const dir = ensureExportsBaseDir()
  const base = `${prefix}_${safeIsoDate(dateISO)}`
  let filePath = path.join(dir, `${base}.pdf`)
  let i = 2
  while (fs.existsSync(filePath)) {
    filePath = path.join(dir, `${base}_${i}.pdf`)
    i++
  }
  return filePath
}

export async function generateCashCheckPDF(options: { cashCheckId: number }): Promise<{ filePath: string }> {
  const cashCheck = getCashCheckById(options.cashCheckId)
  if (!cashCheck) throw new Error('Kassenprüfung nicht gefunden')

  const org = getActiveOrganization()
  const orgName = (org?.name || 'BudgetO').trim() || 'BudgetO'

  const pr1 = cashCheck.inspector1Name && cashCheck.inspector1Name.trim() ? cashCheck.inspector1Name.trim() : ''
  const pr2 = cashCheck.inspector2Name && cashCheck.inspector2Name.trim() ? cashCheck.inspector2Name.trim() : ''
  if (!pr1 && !pr2) {
    const err: any = new Error('KASSENPRUEFER_REQUIRED')
    err.code = 'KASSENPRUEFER_REQUIRED'
    throw err
  }

  const filePath = prepareExportPath('Kassenpruefung', cashCheck.date)

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8"/>
  <title>Kassenprüfung ${esc(cashCheck.date)} – ${esc(orgName)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      padding: 28px 22px;
      color: #222;
      font-size: 11pt;
    }
    h1 { margin: 0 0 6px; font-size: 18pt; }
    .sub { color: #666; font-size: 10pt; margin-bottom: 18px; }
    .box { border: 1px solid #ddd; border-radius: 10px; padding: 14px; }
    .row { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; border-bottom: 1px dashed #e3e3e3; }
    .row:last-child { border-bottom: 0; }
    .label { color: #444; }
    .val { font-weight: 600; }
    .note { margin-top: 10px; white-space: pre-wrap; }
    .meta { color:#444; font-size:10pt; }
    .siggrid { margin-top: 26px; display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    .sigbox { border-top: 1px solid #333; padding-top: 6px; font-size: 10pt; }
  </style>
</head>
<body>
  <h1>Kassenprüfer-Bericht (Kassenprüfung)</h1>
  <div class="sub">${esc(orgName)} · Jahr ${esc(cashCheck.year)} · Stichtag ${esc(cashCheck.date)}</div>

  <div class="box">
    <div class="row"><div class="label">Soll-Bestand (BAR)</div><div class="val">${esc(euro(cashCheck.soll))}</div></div>
    <div class="row"><div class="label">Ist-Bestand (gezählt)</div><div class="val">${esc(euro(cashCheck.ist))}</div></div>
    <div class="row"><div class="label">Differenz</div><div class="val">${esc(euro(cashCheck.diff))}</div></div>
    ${cashCheck.voucherNo ? `<div class="row"><div class="label">Ausgleichsbuchung</div><div class="val">${esc(cashCheck.voucherNo)}</div></div>` : ''}
    ${cashCheck.budgetLabel ? `<div class="row"><div class="label">Budget</div><div class="val">${esc(cashCheck.budgetLabel)}</div></div>` : ''}
    ${cashCheck.note ? `<div class="note"><div class="meta">Notiz</div>${esc(cashCheck.note)}</div>` : ''}
  </div>

  <div class="siggrid">
    <div>
      <div style="height: 38px"></div>
      <div class="sigbox">Unterschrift Prüfer 1${pr1 ? ` (${esc(pr1)})` : ''}</div>
    </div>
    <div>
      <div style="height: 38px"></div>
      <div class="sigbox">Unterschrift Prüfer 2${pr2 ? ` (${esc(pr2)})` : ''}</div>
    </div>
  </div>
</body>
</html>`

  const win = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: {
      offscreen: true
    }
  })

  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))

  await new Promise<void>((resolve) => {
    win.webContents.on('did-finish-load', () => setTimeout(resolve, 250))
    setTimeout(resolve, 900)
  })

  const buff = await win.webContents.printToPDF({
    pageSize: 'A4',
    printBackground: true,
    margins: { top: 0, bottom: 0, left: 0, right: 0 }
  })

  fs.writeFileSync(filePath, buff)

  try {
    win.destroy()
  } catch {
    // ignore
  }

  return { filePath }
}
