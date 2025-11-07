import React, { Suspense, lazy } from 'react'

// Lazy-load the heavy renderer App to keep the root lightweight
const RendererApp = lazy(() => import('./renderer/App'))

export default function App() {
	return (
		<Suspense fallback={
			<div className="suspense-fallback">
				<div className="suspense-box" role="status" aria-live="polite" aria-label="Lädt">
					<div className="spinner" aria-hidden="true" />
					<div className="suspense-text">Lädt…</div>
				</div>
			</div>
		}>
			<RendererApp />
		</Suspense>
	)
}
