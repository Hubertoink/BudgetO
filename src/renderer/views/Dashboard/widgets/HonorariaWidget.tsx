import React, { useEffect, useMemo, useState } from 'react'

type InstructorListRow = {
  id: number
  name: string
}

type InstructorInvoice = {
  id: number
  instructorId: number
  date: string
  amount: number
  voucherId: number | null
}

type InstructorYearlySummary = {
  total: number
  cap: number | null
  remaining: number | null
  invoices: InstructorInvoice[]
}

type OpenInvoiceRow = {
  invoiceId: number
  instructorName: string
  date: string
  amount: number
}

async function listAllActiveInstructors(): Promise<InstructorListRow[]> {
  const limit = 100
  let offset = 0
  const all: InstructorListRow[] = []

  // Fetch all pages (robust even if there are more than `limit` rows)
  while (true) {
    const res = await (window as any).api?.instructors?.list?.({
      status: 'ACTIVE',
      limit,
      offset
    })
    const rows = (res?.rows || []) as InstructorListRow[]
    all.push(...rows)
    if (rows.length < limit) break
    offset += limit
  }

  return all
}

async function mapBatched<T, R>(items: readonly T[], batchSize: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const res = await Promise.all(batch.map(fn))
    out.push(...res)
  }
  return out
}

export default function HonorariaWidget({ year }: { year: number }) {
  const eur = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [instructorsCount, setInstructorsCount] = useState(0)
  const [yearTotal, setYearTotal] = useState(0)
  const [openCount, setOpenCount] = useState(0)
  const [openAmount, setOpenAmount] = useState(0)
  const [openTop, setOpenTop] = useState<OpenInvoiceRow[]>([])

  useEffect(() => {
    let alive = true

    const load = async () => {
      try {
        setLoading(true)
        setError(null)

        const instructors = await listAllActiveInstructors()
        if (!alive) return

        setInstructorsCount(instructors.length)

        const summaries = await mapBatched(instructors, 10, async (inst) => {
          const res = await (window as any).api?.instructors?.yearlySummary?.({ instructorId: inst.id, year })
          return (res || { total: 0, cap: null, remaining: null, invoices: [] }) as InstructorYearlySummary
        })
        if (!alive) return

        const total = summaries.reduce((s, x) => s + Number(x.total || 0), 0)
        const openInvoices = summaries.flatMap((s, idx) => {
          const inst = instructors[idx]
          const name = inst?.name || '—'
          return (s.invoices || [])
            .filter((inv) => inv.voucherId == null)
            .map((inv) => ({ invoiceId: inv.id, instructorName: name, date: String(inv.date || ''), amount: Number(inv.amount || 0) }))
        })
        const openSum = openInvoices.reduce((s, inv) => s + Number(inv.amount || 0), 0)
        const top = openInvoices
          .filter((x) => x.amount > 0)
          .sort((a, b) => {
            const ad = String(a.date || '')
            const bd = String(b.date || '')
            if (ad !== bd) return bd.localeCompare(ad)
            return b.amount - a.amount
          })
          .slice(0, 5)

        setYearTotal(total)
        setOpenCount(openInvoices.length)
        setOpenAmount(openSum)
        setOpenTop(top)
      } catch (e: any) {
        if (!alive) return
        setError(e?.message || 'Laden fehlgeschlagen')
        setInstructorsCount(0)
        setYearTotal(0)
        setOpenCount(0)
        setOpenAmount(0)
        setOpenTop([])
      } finally {
        if (alive) setLoading(false)
      }
    }

    load()
    const onChanged = () => load()
    window.addEventListener('data-changed', onChanged)
    return () => {
      alive = false
      window.removeEventListener('data-changed', onChanged)
    }
  }, [year])

  return (
    <section className="card" style={{ padding: 16 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <strong>Honorare (Übungsleiter)</strong>
        <span className="helper">{year}</span>
      </header>

      {loading ? (
        <div className="helper" style={{ marginTop: 8 }}>Lädt…</div>
      ) : error ? (
        <div className="helper" style={{ marginTop: 8, color: 'var(--danger)' }}>{error}</div>
      ) : instructorsCount === 0 ? (
        <div className="helper" style={{ marginTop: 8 }}>Keine aktiven Übungsleiter.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 12 }}>
            <div className="card" style={{ padding: 12 }}>
              <div className="helper">Aktive Übungsleiter</div>
              <div className="summary-value-overflow">{instructorsCount}</div>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div className="helper">Offen (nicht verbucht)</div>
              <div className="summary-value-overflow">{eur.format(openAmount)} <span className="helper">({openCount})</span></div>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div className="helper">Summe im Jahr</div>
              <div className="summary-value-overflow">{eur.format(yearTotal)}</div>
            </div>
          </div>

          {openTop.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <div className="helper" style={{ marginBottom: 6 }}>Top 5 offen</div>
              <div style={{ display: 'grid', gap: 6 }}>
                {openTop.map((r) => (
                  <div key={r.invoiceId} className="card" style={{ padding: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.instructorName}</div>
                        <div className="helper">{r.date || '—'}</div>
                      </div>
                      <div style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{eur.format(r.amount)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
