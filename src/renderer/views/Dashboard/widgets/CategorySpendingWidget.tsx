import React, { useEffect, useMemo, useState } from 'react'

type VoucherRow = {
  id: number
  type: 'IN' | 'OUT' | 'TRANSFER'
  grossAmount: number
  categoryId?: number | null
  categoryName?: string | null
  categoryColor?: string | null
}

type CategoryAgg = {
  key: string
  name: string
  color: string | null
  gross: number
}

async function listAllVouchersForRange(from: string, to: string): Promise<VoucherRow[]> {
  const limit = 100
  let offset = 0
  const all: VoucherRow[] = []

  while (true) {
    const res = await (window as any).api?.vouchers?.list?.({
      limit,
      offset,
      from,
      to
    })
    const rows = (res?.rows || []) as VoucherRow[]
    all.push(...rows)
    if (rows.length < limit) break
    offset += limit
  }

  return all
}

export default function CategorySpendingWidget(props: { from: string; to: string }) {
  const eur = useMemo(() => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), [])
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<CategoryAgg[]>([])

  useEffect(() => {
    let alive = true

    const load = async () => {
      try {
        setLoading(true)

        // Only OUT makes sense for spending.
        const rows = await listAllVouchersForRange(props.from, props.to)
        if (!alive) return

        const out = rows.filter((r) => r?.type === 'OUT' && r.categoryId != null)

        const byKey = new Map<string, CategoryAgg>()
        for (const r of out) {
          const id = r.categoryId
          const key = `id:${id}`
          const cur = byKey.get(key)
          const grossAbs = Math.abs(Number(r.grossAmount || 0))
          if (!cur) {
            byKey.set(key, {
              key,
              name: String(r.categoryName || `Kategorie #${id}`),
              color: r.categoryColor || null,
              gross: grossAbs
            })
          } else {
            cur.gross += grossAbs
          }
        }

        const list = Array.from(byKey.values())
          .filter((x) => x.gross > 0)
          .sort((a, b) => b.gross - a.gross)
          .slice(0, 8)

        setItems(list)
      } catch {
        if (!alive) return
        setItems([])
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
  }, [props.from, props.to])

  const total = useMemo(() => items.reduce((s, x) => s + x.gross, 0), [items])

  return (
    <section className="card" style={{ padding: 16 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <strong>Ausgaben nach Kategorie</strong>
        <span className="helper">{props.from} → {props.to}</span>
      </header>

      {loading ? (
        <div className="helper" style={{ marginTop: 8 }}>Lädt…</div>
      ) : items.length === 0 ? (
        <div className="helper" style={{ marginTop: 8 }}>Keine kategorisierten Ausgaben im Zeitraum.</div>
      ) : (
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {items.map((it) => {
            const pct = total > 0 ? (it.gross / total) * 100 : 0
            const barColor = it.color || 'var(--accent)'
            return (
              <div key={it.key} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: barColor, flex: '0 0 auto' }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
                    </div>
                    <span className="helper" style={{ whiteSpace: 'nowrap' }}>{pct.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 10, background: 'var(--border)', borderRadius: 999, overflow: 'hidden', marginTop: 6 }}>
                    <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, pct))}%`, background: barColor }} />
                  </div>
                </div>
                <div style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{eur.format(it.gross)}</div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
