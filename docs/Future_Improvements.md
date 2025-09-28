# VereinO – Future Improvements

This document proposes next-step features and design details. It focuses on three concrete items you requested and adds a short backlog of high‑value upgrades.

## 1) Bank CSV Import (Sparkasse)

Goal: Import Sparkasse Online-Banking CSV into Buchungen with minimal friction and safe duplicates handling.

### File specifics (Sparkasse CSV)

- Encoding: Windows-1252 or UTF-8 with BOM (we should auto-detect; prefer UTF-8 on save).
- Separator: semicolon `;`.
- Decimal: comma `,`, thousands `.`.
- Date: usually `dd.mm.yyyy`.
- Headers vary by export; common columns: `Buchungstag`, `Valutadatum`, `Auftraggeber/Empfänger`, `Verwendungszweck`, `Betrag`, `Währung`, `Saldo`, `Buchungstext`, `Kategorie`, `IBAN/Kontonummer`, `Gläubiger-ID`, `Mandatsreferenz`.

### Minimal mapping → Voucher fields

- date ← `Buchungstag` (fallback `Valutadatum`)
- description ← concat(`Buchungstext`, `Verwendungszweck`) truncated to ~240 chars
- party (optional display only) ← `Auftraggeber/Empfänger`
- grossAmount ← abs(parsed(`Betrag`))
- type ← `IN` if Betrag > 0, `OUT` if Betrag < 0
- paymentMethod ← `BANK`
- tags (optional, rule-based) ← patterns in `Buchungstext`/`Verwendungszweck`
- sphere, earmarkId, budgetId left empty unless rules assign them

We do not import: Saldo, Kategorie (bank-proprietary), internal IDs. We may store raw-row JSON for audit/debug.

### Parsing rules

- Trim quotes; handle multi-line purpose fields.
- Number: de-DE parsing: remove `.` thousands, replace `,` with `.` → Number.
- Date: parse `dd.mm.yyyy` → ISO `yyyy-mm-dd` (use UTC to avoid timezone shifts).
- Merge free-text: deduplicate whitespace, strip emojis/control chars.

### Duplicate detection

- Candidate key: `date`, `grossAmount`, and normalized reference hash of `Verwendungszweck` + `Auftraggeber/Empfänger` (lowercased, spaces collapsed).
- Additionally, re-check against vouchers created by previous imports and against posted vouchers from Invoices.
- Strategy: mark row as "duplicate" in preview and skip by default; allow force-import per row.

### Import flow (UI)

1. Choose CSV file.
2. Preview modal shows:
   - first 100 rows parsed, with columns: Date, IN/OUT, Amount, Party, Purpose, Duplicate?, Suggested Tags.
   - counters: total rows, valid, duplicates, will import.
3. Options:
   - Date window filter, min/max amount filter.
   - Rules: "OUT negative" vs "Both positive" amounts (default OUT negative; internally we import absolute and set type).
   - Tagging rules: add tags by substring regex.
4. Execute import:
   - Create vouchers one-by-one with payload `{ date, type, sphere?, paymentMethod: 'BANK', description, grossAmount, earmarkId?, budgetId?, tags? }`.
   - Error handling: collect row errors; continue other rows; show summary with download of error CSV.
5. Post actions:
   - Toast summary; refresh Buchungen; link to filter by date range used.

### Acceptance criteria

- Can import a real Sparkasse CSV with hundreds of rows in < 10s.
- Correct de-DE number/date parsing; IN/OUT detection is accurate.
- Duplicate rows are detected and not imported by default.
- Preview shows at least first 100 rows; execution reports imported/skipped/errors.
- Imported rows appear in Buchungen with paymentMethod=BANK and correct grossAmount sign handling.

---

## 2) Jahresabschluss Export

Goal: One-click year-end package for audits and archiving.

### Scope

- Choose year and (optionally) sphere.
- Exports into a dated folder or ZIP:
  1. Reports (PDF + CSV):
     - Einnahmen/Ausgaben (P&L-like) per sphere
     - Monatsübersicht (CSV, totals by month and type)
     - Budget vs. Ist (CSV) with variance
  2. Journal CSV (all vouchers in the period) with stable columns: `date,voucherNo,type,sphere,description,paymentMethod,net,vat,gross,tags,earmark,budget`.
  3. Attachments ZIP: `attachments/` with subfolders per voucher: `YYYY/TYPE/#<voucherNo>/…`.
  4. Machine-readable JSON snapshot: all vouchers with line items and tags, plus metadata (org, app version, export timestamp).
  5. Checks file (TXT): summary, totals reconciliation, and warnings (e.g., missing sphere, earmark overdraw, gaps in numbering).

### UX

- Dialog: pick year, sphere (optional), include attachments (toggle), output as ZIP or folder.
- Show estimate: number of vouchers, total size estimate for attachments.
- Progress bar with current step; supports cancel.

### Implementation notes

- Reuse existing `reports.*` endpoints for summaries; add a `reports.export` orchestrator that writes files and returns final path.
- Stream attachments to ZIP to avoid memory spikes.
- Use ISO dates in filenames; sanitize all names.

### Acceptance criteria

- Export completes with consistent totals that match in-app reports for the selected period.
- Folder/ZIP structure is deterministic and documented.
- CSV opens in Excel (de-DE) correctly.
- Optional: Validate JSON against schema for future compatibility.

---

## 3) Invoices: Anhänge nachträglich hinzufügen (Edit-Modal)

Goal: Allow uploads and management of invoice attachments after creation.

### API changes

- Add `window.api.invoiceFiles` endpoints analogous to `attachments`:
  - `list({ invoiceId }) => { files: [{ id, fileName, mimeType?, size?, createdAt? }] }`
  - `add({ invoiceId, fileName, dataBase64, mimeType? }) => { id }`
  - `delete({ fileId }) => { id }`
  - Reuse existing `open/saveAs/read` from `invoiceFiles` (already present).

### UI changes (renderer)

- In `InvoicesView` edit modal:
  - Add an "Anhänge" card on the right column (below Auto-Buchung) with:
    - Button “+ Datei(en)” to pick files.
    - Dropzone support.
    - List existing files with Open, Herunterladen, Löschen.
  - On save, no change needed; uploads occur immediately.

### Behavior

- Newly added files appear instantly; errors are toasts.
- Deleting asks for confirmation.
- Works for both IN and OUT invoices; respects file type limits set on main process.

### Acceptance criteria

- Existing invoice can be edited and files added/removed without schema errors.
- Files open and save-as work through `invoiceFiles`.
- List updates after each change without closing the modal.

---

## Backlog (high value)

- Transfer Wizard (BAR ↔ BANK) with duplicate guard and linked postings.
- Saved filters + quick chips for Buchungen/Rechnungen.
- Bulk tagging and budget/earmark assignment in lists.
- Bank statement reconciliation rules and learning tags by party.
- Virtualized tables for >10k rows.
- Audit log and backup/restore with encryption.
