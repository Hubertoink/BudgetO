export default function App() {
    return (
        <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif' }}>
            <h1>Verein Finanzplaner</h1>
            <p>Electron + React + TypeScript scaffold bereit.</p>
            <p>
                API ping: <code>{(window as any).api?.ping?.()}</code>
            </p>
        </div>
    )
}
