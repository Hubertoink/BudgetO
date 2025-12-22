import React from 'react'
import { GeneralPaneProps, BackgroundImage } from '../types'

// Hintergrundbilder - Vorschau für die Auswahl
import mountainCloudsImg from '../../../assets/a_mountain_with_snow_and_clouds.jpg'
import snowyLandscapeImg from '../../../assets/a_snowy_landscape_with_trees_and_a_light_on_it.jpg'
import snowHousesImg from '../../../assets/a_snow_covered_houses_and_a_street_light.png'

const BG_IMAGES: Record<BackgroundImage, { label: string; emoji: string; thumb?: string }> = {
  none: { label: 'Kein Hintergrundbild', emoji: '🚫' },
  'mountain-clouds': { label: 'Berglandschaft', emoji: '🏔️', thumb: mountainCloudsImg },
  'snowy-landscape': { label: 'Schneelandschaft', emoji: '❄️', thumb: snowyLandscapeImg },
  'snow-houses': { label: 'Winterdorf', emoji: '🏘️', thumb: snowHousesImg },
}

/**
 * GeneralPane - Darstellung & Layout Settings
 *
 * Handles:
 * - Setup wizard re-open
 * - Theme selection
 * - Navigation layout (left/top)
 * - Journal row style & density
 * - Date format
 */
export function GeneralPane({
  journalRowStyle,
  setJournalRowStyle,
  journalRowDensity,
  setJournalRowDensity,
  navLayout,
  setNavLayout,
  sidebarCollapsed,
  setSidebarCollapsed,
  navIconColorMode,
  setNavIconColorMode,
  colorTheme,
  setColorTheme,
  backgroundImage,
  setBackgroundImage,
  journalLimit,
  setJournalLimit,
  dateFmt,
  setDateFmt,
  openSetupWizard,
  glassModals,
  setGlassModals,
}: GeneralPaneProps) {
  // Date format examples
  const sample = '2025-01-15'
  const pretty = '15. Jan 2025'

  return (
    <div className="settings-pane">
      {/* Setup (Erststart) – Reopen wizard */}
      <div className="card settings-pane-card">
        <div className="settings-title">
          <span aria-hidden="true">✨</span> <strong>Setup (Erststart)</strong>
        </div>
        <div className="settings-sub">
          Öffne den Einrichtungs-Assistenten erneut, um Sachgebiet, Darstellung und Tags schnell zu konfigurieren.
        </div>
        <div className="settings-pane-actions">
          <button className="btn" onClick={() => openSetupWizard?.()}>
            Setup erneut öffnen…
          </button>
        </div>
      </div>

      {/* Cluster: Farbschema & Design - organization-specific */}
      <div className="card settings-card settings-pane-card">
        <div className="settings-title">
          <span aria-hidden="true">🎨</span> <strong>Farbschema & Design</strong>
        </div>
        <div className="settings-sub">
          Diese Einstellungen werden pro Sachgebiet gespeichert.
        </div>
        
        {/* Theme and Glass effect */}
        <div className="settings-row-2col" style={{ marginTop: 12 }}>
          <div className="field">
            <label htmlFor="select-color-theme">Farb-Theme</label>
            <select id="select-color-theme" className="input" value={colorTheme} onChange={(e) => setColorTheme(e.target.value as any)}>
              <option value="default">Standard ◐</option>
              <option value="fiery-ocean">Fiery Ocean ●</option>
              <option value="peachy-delight">Peachy Delight ●</option>
              <option value="pastel-dreamland">Pastel Dreamland ●</option>
              <option value="ocean-breeze">Earthy Palette ●</option>
              <option value="earthy-tones">Earthy Tones ●</option>
              <option value="monochrome-harmony">Monochrome Harmony ●</option>
              <option value="vintage-charm">Vintage Charm ●</option>
              <option value="soft-blush">Soft Blush ○</option>
              <option value="professional-light">Professional Light ○</option>
            </select>
            <div className="helper">● = Dark | ○ = Light</div>
          </div>
          <div className="settings-inline-toggle" style={{ alignSelf: 'flex-start', marginTop: 24 }}>
            <label htmlFor="toggle-glass-modals">Glaseffekt (Blur)</label>
            <input
              id="toggle-glass-modals"
              role="switch"
              aria-checked={glassModals}
              className="toggle"
              type="checkbox"
              checked={glassModals}
              onChange={(e) => setGlassModals(e.target.checked)}
            />
          </div>
        </div>

        {/* Hintergrundbild-Auswahl mit Vorschaubildern */}
        <div className="field" style={{ marginTop: 16 }}>
          <label>Hintergrundbild</label>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
            {(Object.keys(BG_IMAGES) as BackgroundImage[]).map((key) => {
              const img = BG_IMAGES[key]
              const isSelected = backgroundImage === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setBackgroundImage(key)}
                  style={{
                    width: 110,
                    height: 75,
                    borderRadius: 8,
                    border: isSelected ? '3px solid var(--primary)' : '2px solid var(--border)',
                    background: img.thumb ? `url(${img.thumb}) center/cover` : 'var(--surface-alt)',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'border-color 0.2s, transform 0.15s',
                    transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                    boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.3)' : 'none'
                  }}
                  title={img.label}
                >
                  {!img.thumb && (
                    <span style={{ 
                      position: 'absolute', 
                      inset: 0, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      fontSize: 28,
                      color: 'var(--text-dim)'
                    }}>
                      {img.emoji}
                    </span>
                  )}
                  <span style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    fontSize: 10,
                    padding: '3px 4px',
                    textAlign: 'center',
                  }}>
                    {img.label}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="helper" style={{ marginTop: 8 }}>Wähle ein Hintergrundbild für die App.</div>
        </div>
      </div>

      {/* Cluster: Navigation & Layout */}
      <div className="card settings-card settings-pane-card">
        <div className="settings-title">
          <span aria-hidden="true">🧭</span> <strong>Navigation & Layout</strong>
        </div>
        <div className="settings-sub">Passe die Darstellung deiner Menüs und Buchungstabelle an.</div>
        
        {/* Row 1: Layout options */}
        <div className="settings-row-2col" style={{ marginTop: 12 }}>
          <div className="field">
            <label>Menü-Layout</label>
            <div className="btn-group">
              <button
                type="button"
                className={`btn-option ${navLayout === 'left' ? 'active' : ''}`}
                onClick={() => setNavLayout('left')}
              >
                Links (klassisch)
              </button>
              <button
                type="button"
                className={`btn-option ${navLayout === 'top' ? 'active' : ''}`}
                onClick={() => setNavLayout('top')}
              >
                Oben (icons)
              </button>
            </div>
          </div>
          <div className="field">
            <label>Zeilenhöhe</label>
            <div className="btn-group">
              <button
                type="button"
                className={`btn-option ${journalRowDensity === 'normal' ? 'active' : ''}`}
                onClick={() => setJournalRowDensity('normal')}
              >
                Normal
              </button>
              <button
                type="button"
                className={`btn-option ${journalRowDensity === 'compact' ? 'active' : ''}`}
                onClick={() => setJournalRowDensity('compact')}
              >
                Kompakt
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Row style */}
        <div className="settings-row-2col" style={{ marginTop: 12 }}>
          <div className="field">
            <label htmlFor="select-row-style">Buchungen: Zeilenlayout</label>
            <select id="select-row-style" className="input" value={journalRowStyle} onChange={(e) => setJournalRowStyle(e.target.value as any)}>
              <option value="both">Linien + Zebra</option>
              <option value="lines">Nur Linien</option>
              <option value="zebra">Nur Zebra</option>
              <option value="none">Ohne Linien/Zebra</option>
            </select>
          </div>
          <div className="field" />
        </div>

        {/* Row 3: Toggles in a grid */}
        <div className="settings-row-3col" style={{ marginTop: 16 }}>
          <div className="settings-inline-toggle">
            <label htmlFor="toggle-menu-icons">Farbige Menüicons</label>
            <input
              id="toggle-menu-icons"
              role="switch"
              aria-checked={navIconColorMode === 'color'}
              className="toggle"
              type="checkbox"
              checked={navIconColorMode === 'color'}
              onChange={(e) => setNavIconColorMode(e.target.checked ? 'color' : 'mono')}
            />
          </div>
        </div>
      </div>

      {/* Cluster 2: Anzeige & Lesbarkeit */}
      <div className="card settings-card settings-pane-card">
        <div className="settings-title">
          <span aria-hidden="true">🔎</span> <strong>Anzeige & Lesbarkeit</strong>
        </div>
        <div className="settings-sub">Kontrolliere Anzahl und Darstellung zentraler Informationen.</div>
        <div className="settings-row-2col" style={{ marginTop: 12 }}>
          <div className="field">
            <label>Buchungen: Anzahl der Einträge</label>
            <div className="btn-group">
              <button
                type="button"
                className={`btn-option ${journalLimit === 20 ? 'active' : ''}`}
                onClick={() => setJournalLimit(20)}
              >
                20
              </button>
              <button
                type="button"
                className={`btn-option ${journalLimit === 50 ? 'active' : ''}`}
                onClick={() => setJournalLimit(50)}
              >
                50
              </button>
              <button
                type="button"
                className={`btn-option ${journalLimit === 100 ? 'active' : ''}`}
                onClick={() => setJournalLimit(100)}
              >
                100
              </button>
            </div>
          </div>
          <div className="field">
            <label>Datumsformat</label>
            <div className="btn-group">
              <button
                type="button"
                className={`btn-option ${dateFmt === 'ISO' ? 'active' : ''}`}
                onClick={() => setDateFmt('ISO')}
              >
                {sample}
              </button>
              <button
                type="button"
                className={`btn-option ${dateFmt === 'PRETTY' ? 'active' : ''}`}
                onClick={() => setDateFmt('PRETTY')}
              >
                {pretty}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

