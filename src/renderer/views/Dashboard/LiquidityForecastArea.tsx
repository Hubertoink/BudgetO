import React from 'react'
import type { LiquidityForecastAreaProps } from './types'

export default function LiquidityForecastArea({ horizonDays = 90 }: LiquidityForecastAreaProps) {
  return (
    <section className="card" style={{ padding: 12 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <strong>Liquiditätsvorschau</strong>
        <span className="helper">nächste {horizonDays} Tage (placeholder)</span>
      </header>
      <div style={{ height: 200, borderRadius: 8, background: 'linear-gradient(180deg, rgba(106,166,255,0.35), transparent 60%)' }} />
    </section>
  )
}
