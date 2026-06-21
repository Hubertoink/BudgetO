import React, { useEffect, useRef, useState } from 'react'
import { GeneralPaneProps, BackgroundImage } from '../types'

// Hintergrundbilder - Vorschau für die Auswahl
import mountainCloudsImg from '../../../assets/a_mountain_with_snow_and_clouds.jpg'
import snowyLandscapeImg from '../../../assets/a_snowy_landscape_with_trees_and_a_light_on_it.jpg'
import snowHousesImg from '../../../assets/a_snow_covered_houses_and_a_street_light.png'

type CompressedImageResult = {
  dataUrl: string
  approxBytes: number
  originalWidth: number
  originalHeight: number
  finalWidth: number
  finalHeight: number
}

function approxBytesFromDataUrl(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex < 0) return dataUrl.length
  const base64 = dataUrl.slice(commaIndex + 1)
  // base64 payload size ≈ 3/4 of length minus padding
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - padding
}

async function canvasToDataUrl(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode image'))
          return
        }
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read encoded image'))
        reader.readAsDataURL(blob)
      },
      mimeType,
      quality
    )
  })
}

async function compressImageFile(file: File, opts: { maxDimension: number; targetBytes: number }): Promise<CompressedImageResult> {
  const mimeType = 'image/jpeg'

  const bitmap = await createImageBitmap(file)
  const originalWidth = bitmap.width
  const originalHeight = bitmap.height
  const scale = Math.min(1, opts.maxDimension / Math.max(bitmap.width, bitmap.height))
  let width = Math.max(1, Math.round(bitmap.width * scale))
  let height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  // Fill background (JPEG has no alpha)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, width, height)

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  // Try qualities from high to lower until we hit targetBytes
  const qualities = [0.92, 0.88, 0.84, 0.8, 0.76, 0.72, 0.68, 0.64]
  let bestDataUrl: string | null = null
  let bestBytes = Number.POSITIVE_INFINITY
  let finalWidth = width
  let finalHeight = height

  for (const quality of qualities) {
    const dataUrl = await canvasToDataUrl(canvas, mimeType, quality)
    const approxBytes = approxBytesFromDataUrl(dataUrl)
    if (approxBytes < bestBytes) {
      bestDataUrl = dataUrl
      bestBytes = approxBytes
      finalWidth = width
      finalHeight = height
    }
    if (approxBytes <= opts.targetBytes) {
      return { dataUrl, approxBytes, originalWidth, originalHeight, finalWidth: width, finalHeight: height }
    }
  }

  // If still too big, progressively scale down a bit more and retry
  let currentScale = 0.9
  while (bestBytes > opts.targetBytes && currentScale >= 0.5) {
    const newWidth = Math.max(1, Math.round(width * currentScale))
    const newHeight = Math.max(1, Math.round(height * currentScale))
    canvas.width = newWidth
    canvas.height = newHeight

    const ctx2 = canvas.getContext('2d', { alpha: false })
    if (!ctx2) break
    ctx2.fillStyle = '#000'
    ctx2.fillRect(0, 0, newWidth, newHeight)
    ctx2.imageSmoothingEnabled = true
    ctx2.imageSmoothingQuality = 'high'
    // Recreate bitmap to avoid quality loss from re-scaling a scaled bitmap
    const bitmap2 = await createImageBitmap(file)
    ctx2.drawImage(bitmap2, 0, 0, newWidth, newHeight)
    bitmap2.close()

    for (const quality of qualities.slice(2)) {
      const dataUrl = await canvasToDataUrl(canvas, mimeType, quality)
      const approxBytes = approxBytesFromDataUrl(dataUrl)
      if (approxBytes < bestBytes) {
        bestDataUrl = dataUrl
        bestBytes = approxBytes
        finalWidth = newWidth
        finalHeight = newHeight
      }
      if (approxBytes <= opts.targetBytes) {
        return { dataUrl, approxBytes, originalWidth, originalHeight, finalWidth: newWidth, finalHeight: newHeight }
      }
    }

    currentScale -= 0.1
  }

  if (!bestDataUrl) {
    throw new Error('Failed to compress image')
  }
  return { dataUrl: bestDataUrl, approxBytes: bestBytes, originalWidth, originalHeight, finalWidth, finalHeight }
}

// Nur die vordefinierten Bilder (ohne 'custom' - das wird separat gehandhabt)
const BG_IMAGES: Record<Exclude<BackgroundImage, 'custom'>, { label: string; emoji: string; thumb?: string }> = {
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
  customBackgroundImage,
  setCustomBackgroundImage,
  journalLimit,
  setJournalLimit,
  dateFmt,
  setDateFmt,
  openSetupWizard,
  glassModals,
  setGlassModals,
  backgroundContrast,
  setBackgroundContrast,
  modalBackdropBlur,
  setModalBackdropBlur,
  showBookingDraftTabs,
  setShowBookingDraftTabs,
  showBookingEditTabs,
  setShowBookingEditTabs,
  bookingsOpenDetached,
  setBookingsOpenDetached,
}: GeneralPaneProps) {
  const themeOptions: ReadonlyArray<{ value: typeof colorTheme; label: string }> = [
    { value: 'default', label: 'Standard' },
    { value: 'fiery-ocean', label: 'Fiery Ocean' },
    { value: 'peachy-delight', label: 'Peachy Delight' },
    { value: 'pastel-dreamland', label: 'Pastel Dreamland' },
    { value: 'ocean-breeze', label: 'Earthy Palette' },
    { value: 'earthy-tones', label: 'Earthy Tones' },
    { value: 'monochrome-harmony', label: 'Monochrome Harmony' },
    { value: 'vintage-charm', label: 'Vintage Charm' },
    { value: 'soft-blush', label: 'Soft Blush' },
    { value: 'professional-light', label: 'Professional' },
    { value: 'wisteria-pastel', label: 'Wisteria Pastel' },
  ]

  // Date format examples
  const sample = '2025-01-15'
  const pretty = '15. Jan 2025'
  const short = '15.01.25'

  // Ref für den versteckten File-Input
  const fileInputRef = useRef<HTMLInputElement>(null)

  // State für Bild-Verarbeitung
  const [isProcessingImage, setIsProcessingImage] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<string>('')
  const [compressionResult, setCompressionResult] = useState<{
    originalSize: string
    finalSize: string
    originalDimensions: string
    finalDimensions: string
  } | null>(null)
  const [autoUpdateCheck, setAutoUpdateCheck] = useState(true)

  useEffect(() => {
    let disposed = false
    window.api?.settings?.get?.({ key: 'updates.autoCheck' })
      .then((result) => { if (!disposed) setAutoUpdateCheck(result?.value !== false) })
      .catch(() => {})
    return () => { disposed = true }
  }, [])

  // Helper: Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  // Handler für Custom-Bild-Upload
  const handleCustomImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Nur Bilder erlauben
    if (!file.type.startsWith('image/')) {
      return
    }

    // Sehr große Dateien erst mal abweisen (UX + RAM) – wir komprimieren zwar,
    // aber ab einem gewissen Punkt wird es unnötig schwergewichtig.
    if (file.size > 25 * 1024 * 1024) {
      alert('Das Bild ist sehr groß (max. 25MB). Bitte wähle eine kleinere Datei.')
      return
    }

    setIsProcessingImage(true)
    setProcessingStatus('Bild wird geladen…')
    setCompressionResult(null)

    // Input zurücksetzen für erneutes Hochladen derselben Datei
    e.target.value = ''

    try {
      setProcessingStatus('Bild wird optimiert…')
      
      // Ziel: unter ~2MB binär (entspricht grob < 3MB base64, damit localStorage stabil bleibt)
      const result = await compressImageFile(file, { maxDimension: 3000, targetBytes: 2 * 1024 * 1024 })
      
      if (result.approxBytes > 2 * 1024 * 1024) {
        setIsProcessingImage(false)
        alert('Das Bild konnte nicht klein genug komprimiert werden. Bitte wähle ein kleineres Bild.')
        return
      }

      // Zeige Ergebnis
      setCompressionResult({
        originalSize: formatBytes(file.size),
        finalSize: formatBytes(result.approxBytes),
        originalDimensions: `${result.originalWidth} × ${result.originalHeight}`,
        finalDimensions: `${result.finalWidth} × ${result.finalHeight}`,
      })
      setProcessingStatus('Fertig!')

      // Anwenden
      setCustomBackgroundImage(result.dataUrl)
      setBackgroundImage('custom')

      // Modal nach kurzer Verzögerung schließen
      setTimeout(() => {
        setIsProcessingImage(false)
        setCompressionResult(null)
      }, 2000)

    } catch (err) {
      console.error('Image compression failed:', err)
      setIsProcessingImage(false)
      alert('Bild konnte nicht verarbeitet werden. Bitte versuche ein anderes Bild.')
    }
  }

  // Handler zum Entfernen des Custom-Bildes
  const handleRemoveCustomImage = () => {
    setCustomBackgroundImage(null)
    if (backgroundImage === 'custom') {
      setBackgroundImage('none')
    }
  }

  return (
    <div className="settings-pane">
      {/* Image Processing Modal */}
      {isProcessingImage && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div 
            className="card"
            style={{
              padding: 24,
              minWidth: 300,
              maxWidth: 400,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>🖼️</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{processingStatus}</div>
            
            {compressionResult ? (
              <div style={{ 
                marginTop: 16, 
                padding: 12, 
                background: 'var(--surface-alt, var(--muted))', 
                borderRadius: 8,
                textAlign: 'left',
                fontSize: 13,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-dim)' }}>Original:</span>
                  <span>{compressionResult.originalDimensions} • {compressionResult.originalSize}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Optimiert:</span>
                  <span style={{ color: 'var(--success)' }}>{compressionResult.finalDimensions} • {compressionResult.finalSize}</span>
                </div>
              </div>
            ) : (
              <div style={{ 
                marginTop: 12,
                height: 4,
                background: 'var(--border)',
                borderRadius: 2,
                overflow: 'hidden',
              }}>
                <div 
                  style={{
                    height: '100%',
                    width: '30%',
                    background: 'var(--accent)',
                    borderRadius: 2,
                    animation: 'processingBar 1.5s ease-in-out infinite',
                  }}
                />
              </div>
            )}
            
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-dim)' }}>
              {compressionResult 
                ? '✓ Hintergrundbild wurde gesetzt'
                : 'Große Bilder werden automatisch verkleinert…'
              }
            </div>
          </div>
        </div>
      )}

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
            <label>Farb-Theme</label>
            <div className="theme-picker" role="radiogroup" aria-label="Farb-Theme">
              {themeOptions.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={colorTheme === t.value}
                  className={`theme-chip ${colorTheme === t.value ? 'active' : ''}`}
                  onClick={() => setColorTheme(t.value)}
                  data-theme={t.value}
                >
                  <span className="theme-swatch" data-theme={t.value} aria-hidden="true" />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gap: 8, alignContent: 'start', marginTop: 24 }}>
            <div className="settings-inline-toggle" style={{ padding: 0 }}>
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
            <div className="settings-inline-toggle" style={{ padding: 0 }}>
              <label htmlFor="toggle-modal-backdrop-blur">Modal-Hintergrund blur</label>
              <input
                id="toggle-modal-backdrop-blur"
                role="switch"
                aria-checked={modalBackdropBlur}
                className="toggle"
                type="checkbox"
                checked={modalBackdropBlur}
                onChange={(e) => setModalBackdropBlur(e.target.checked)}
              />
            </div>
            <div className="helper" style={{ marginTop: -2 }}>
              Weichzeichnet den Hintergrund hinter Modalen (z.B. Buchung anlegen, PDF Export).
            </div>
          </div>
        </div>

        {/* Hintergrundbild-Auswahl mit Vorschaubildern */}
        <div className="field" style={{ marginTop: 16 }}>
          <label>Hintergrundbild</label>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
            {(Object.keys(BG_IMAGES) as Exclude<BackgroundImage, 'custom'>[]).map((key) => {
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

            {/* Custom Image Tile */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => {
                  if (customBackgroundImage) {
                    setBackgroundImage('custom')
                  } else {
                    fileInputRef.current?.click()
                  }
                }}
                style={{
                  width: 110,
                  height: 75,
                  borderRadius: 8,
                  border: backgroundImage === 'custom' ? '3px solid var(--primary)' : '2px solid var(--border)',
                  background: customBackgroundImage 
                    ? `url("${customBackgroundImage}") center/cover` 
                    : 'var(--surface-alt)',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'border-color 0.2s, transform 0.15s',
                  transform: backgroundImage === 'custom' ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: backgroundImage === 'custom' ? '0 4px 12px rgba(0,0,0,0.3)' : 'none'
                }}
                title={customBackgroundImage ? 'Eigenes Bild' : 'Eigenes Bild hochladen'}
              >
                {!customBackgroundImage && (
                  <span style={{ 
                    position: 'absolute', 
                    inset: 0, 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    justifyContent: 'center',
                    gap: 2,
                    color: 'var(--text-dim)'
                  }}>
                    <span style={{ fontSize: 22 }}>📷</span>
                    <span style={{ fontSize: 9, opacity: 0.8 }}>Hochladen</span>
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
                  Eigenes Bild
                </span>
              </button>
              
              {/* Buttons für Ändern/Löschen wenn Custom-Bild vorhanden */}
              {customBackgroundImage && (
                <div style={{ 
                  display: 'flex', 
                  gap: 4, 
                  marginTop: 4,
                  justifyContent: 'center'
                }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: '2px 6px',
                      fontSize: 10,
                      borderRadius: 4,
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      cursor: 'pointer',
                    }}
                    title="Anderes Bild wählen"
                  >
                    Ändern
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveCustomImage}
                    style={{
                      padding: '2px 6px',
                      fontSize: 10,
                      borderRadius: 4,
                      border: '1px solid var(--danger)',
                      background: 'transparent',
                      color: 'var(--danger)',
                      cursor: 'pointer',
                    }}
                    title="Eigenes Bild entfernen"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleCustomImageUpload}
              style={{ display: 'none' }}
            />
          </div>
          <div className="helper" style={{ marginTop: 8 }}>Wähle ein Hintergrundbild für die App oder lade ein eigenes hoch.</div>
          <div className="settings-inline-toggle" style={{ marginTop: 12, padding: 0 }}>
            <div>
              <label htmlFor="toggle-background-contrast">Kontrastmodus für Bildhintergründe</label>
              <div className="helper">Macht Karten und Buchungstabellen deckender und Texte besser lesbar.</div>
            </div>
            <input
              id="toggle-background-contrast"
              role="switch"
              aria-checked={backgroundContrast}
              className="toggle"
              type="checkbox"
              checked={backgroundContrast}
              disabled={backgroundImage === 'none'}
              onChange={(e) => setBackgroundContrast(e.target.checked)}
            />
          </div>
        </div>
      </div>

      <div className="card settings-card settings-pane-card">
        <div className="settings-title">
          <span aria-hidden="true">⬆️</span> <strong>Updates</strong>
        </div>
        <div className="settings-sub">BudgetO kann beim Programmstart automatisch nach einer neuen Version suchen.</div>
        <div className="settings-inline-toggle" style={{ marginTop: 12 }}>
          <label htmlFor="toggle-auto-update-check">Bei jedem Start nach Updates suchen</label>
          <input
            id="toggle-auto-update-check"
            role="switch"
            aria-checked={autoUpdateCheck}
            className="toggle"
            type="checkbox"
            checked={autoUpdateCheck}
            onChange={(event) => {
              const enabled = event.target.checked
              setAutoUpdateCheck(enabled)
              void window.api?.settings?.set?.({ key: 'updates.autoCheck', value: enabled })
            }}
          />
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
          <div className="settings-inline-toggle">
            <label htmlFor="toggle-booking-draft-tabs">Buchungsentwürfe als Tabs</label>
            <input
              id="toggle-booking-draft-tabs"
              role="switch"
              aria-checked={showBookingDraftTabs}
              className="toggle"
              type="checkbox"
              checked={showBookingDraftTabs}
              onChange={(e) => setShowBookingDraftTabs(e.target.checked)}
            />
            <span className="helper">Mehrere neue Buchungen parallel öffnen und später fortsetzen.</span>
          </div>
          <div className="settings-inline-toggle">
            <label htmlFor="toggle-booking-edit-tabs">Bearbeitungen als Tabs</label>
            <input
              id="toggle-booking-edit-tabs"
              role="switch"
              aria-checked={showBookingEditTabs}
              className="toggle"
              type="checkbox"
              checked={showBookingEditTabs}
              onChange={(e) => setShowBookingEditTabs(e.target.checked)}
            />
            <span className="helper">Mehrere bestehende Buchungen parallel bearbeiten.</span>
          </div>
          <div className="settings-inline-toggle">
            <label htmlFor="toggle-bookings-open-detached">Eigenes Buchungsfenster</label>
            <input
              id="toggle-bookings-open-detached"
              role="switch"
              aria-checked={bookingsOpenDetached}
              className="toggle"
              type="checkbox"
              checked={bookingsOpenDetached}
              onChange={(e) => setBookingsOpenDetached(e.target.checked)}
            />
            <span className="helper">Neue und bearbeitete Buchungen standardmäßig in einem separaten Fenster öffnen.</span>
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
              <button
                type="button"
                className={`btn-option ${dateFmt === 'SHORT' ? 'active' : ''}`}
                onClick={() => setDateFmt('SHORT')}
              >
                {short}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

