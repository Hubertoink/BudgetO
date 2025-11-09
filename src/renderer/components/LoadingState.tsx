import React from 'react'

interface LoadingStateProps {
  message?: string
  size?: 'small' | 'medium' | 'large'
}

/**
 * LoadingState - Einheitliche Lade-Anzeige mit App-Icon
 * 
 * Zeigt das VereinO Icon mit Spinner-Animation und optionalem Text
 * Kann in verschiedenen Größen verwendet werden
 */
export default function LoadingState({ 
  message = 'Lade…', 
  size = 'medium' 
}: LoadingStateProps) {
  const dimensions = {
    small: { icon: 32, spinner: 40, fontSize: 13 },
    medium: { icon: 48, spinner: 56, fontSize: 14 },
    large: { icon: 64, spinner: 72, fontSize: 16 }
  }

  const dim = dimensions[size]

  return (
    <div 
      className="loading-state"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: '40px 20px',
        textAlign: 'center'
      }}
    >
      {/* Rotating spinner ring with icon in center */}
      <div 
        style={{ 
          position: 'relative',
          width: dim.spinner,
          height: dim.spinner
        }}
      >
        {/* Spinner ring */}
        <svg
          className="loading-spinner"
          width={dim.spinner}
          height={dim.spinner}
          viewBox="0 0 50 50"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            animation: 'spin 1.2s linear infinite'
          }}
        >
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="31.4 94.2"
            opacity="0.8"
          />
        </svg>

        {/* VereinO Icon - simplified euro symbol with circle */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: dim.icon,
            height: dim.icon,
            borderRadius: '50%',
            background: 'var(--accent)',
            color: '#0B0E14',
            fontWeight: 700,
            fontSize: dim.icon * 0.6,
            fontFamily: 'Georgia, serif'
          }}
        >
          €
        </div>
      </div>

      {/* Loading message */}
      <div style={{ color: 'var(--text-dim)', fontSize: dim.fontSize }}>
        {message}
      </div>

      {/* Publisher info */}
      <div 
        style={{ 
          color: 'var(--text-dim)', 
          fontSize: dim.fontSize - 2,
          opacity: 0.6,
          marginTop: -8
        }}
      >
        VereinO · Nikolas Häfner
      </div>
    </div>
  )
}

// CSS keyframes sind bereits in styles.css (falls nicht, hier als Kommentar):
// @keyframes spin {
//   to { transform: rotate(360deg); }
// }
