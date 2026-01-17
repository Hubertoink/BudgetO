import React, { useState, useEffect, useRef } from 'react'
import { UIPreferencesContext } from './uiPreferencesContextStore'
import type {
  BackgroundImage,
  ColorTheme,
  DateFormat,
  JournalRowDensity,
  JournalRowStyle,
  NavIconColorMode,
  NavLayout,
  UIPreferencesContextValue
} from './uiPreferencesTypes'

const VALID_BACKGROUNDS: BackgroundImage[] = ['none', 'mountain-clouds', 'snowy-landscape', 'snow-houses', 'custom']

// Glassmorphism: transparent modals with blur

const VALID_THEMES: ColorTheme[] = ['default', 'fiery-ocean', 'peachy-delight', 'pastel-dreamland', 'ocean-breeze', 'earthy-tones', 'monochrome-harmony', 'vintage-charm']

function isValidTheme(theme: string | null | undefined): theme is ColorTheme {
  return !!theme && VALID_THEMES.includes(theme as ColorTheme)
}

export const UIPreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ensureBackgroundElement = () => {
    const existing = document.getElementById('app-background') as HTMLDivElement | null
    if (existing) return existing

    const el = document.createElement('div')
    el.id = 'app-background'
    el.setAttribute('aria-hidden', 'true')
    document.body.prepend(el)
    return el
  }

  const applyCustomBackgroundToDom = (dataUrl: string | null) => {
    const el = ensureBackgroundElement()
    if (dataUrl) {
      el.style.backgroundImage = `url("${dataUrl}")`
    } else {
      el.style.removeProperty('background-image')
    }
  }

  const [navLayout, setNavLayout] = useState<NavLayout>(() => {
    const stored = localStorage.getItem('ui.navLayout')
    return stored === 'left' || stored === 'top' ? stored : 'left'
  })

  // BudgetO: Sidebar is always compact (collapsed)
  const [sidebarCollapsed, setSidebarCollapsedState] = useState<boolean>(true)
  const setSidebarCollapsed = (_val: boolean) => setSidebarCollapsedState(true)

  const [colorTheme, setColorThemeState] = useState<ColorTheme>('default')
  const [backgroundImage, setBackgroundImageState] = useState<BackgroundImage>('none')
  const [customBackgroundImage, setCustomBackgroundImageState] = useState<string | null>(() => {
    try {
      return localStorage.getItem('ui.customBackgroundImage') || null
    } catch {
      return null
    }
  })
  const [glassModals, setGlassModalsState] = useState<boolean>(false)
  
  // Track current org ID for appearance persistence
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null)
  const appearanceInitializedRef = useRef(false)
  
  // Load appearance settings from organization on mount
  useEffect(() => {
    async function loadOrgAppearance() {
      try {
        // Get active organization
        const orgResult = await (window as any).api?.organizations?.active?.()
        const orgId = orgResult?.organization?.id
        if (orgId) {
          setCurrentOrgId(orgId)
          // Get saved appearance for this org
          const appearance = await (window as any).api?.organizations?.activeAppearance?.()
          if (appearance) {
            // Apply color theme
            if (isValidTheme(appearance.colorTheme)) {
              setColorThemeState(appearance.colorTheme)
              localStorage.setItem('ui.colorTheme', appearance.colorTheme)
              document.documentElement.setAttribute('data-color-theme', appearance.colorTheme)
            }
            // Apply background image
            if (appearance.backgroundImage && VALID_BACKGROUNDS.includes(appearance.backgroundImage)) {
              setBackgroundImageState(appearance.backgroundImage)
              localStorage.setItem('ui.backgroundImage', appearance.backgroundImage)
              document.documentElement.setAttribute('data-background-image', appearance.backgroundImage)
              // If custom background, also apply the image to the background element
              if (appearance.backgroundImage === 'custom') {
                const customBg = localStorage.getItem('ui.customBackgroundImage')
                if (customBg) {
                  applyCustomBackgroundToDom(customBg)
                }
              }
            }
            // Apply glass modals
            if (typeof appearance.glassModals === 'boolean') {
              setGlassModalsState(appearance.glassModals)
              localStorage.setItem('ui.glassModals', String(appearance.glassModals))
              document.documentElement.setAttribute('data-glass-modals', String(appearance.glassModals))
            }
            appearanceInitializedRef.current = true
            return
          }
        }
        // Fallback to localStorage if no org appearance found
        const storedTheme = localStorage.getItem('ui.colorTheme')
        if (isValidTheme(storedTheme)) {
          setColorThemeState(storedTheme)
          document.documentElement.setAttribute('data-color-theme', storedTheme)
        }
        const storedBg = localStorage.getItem('ui.backgroundImage')
        if (storedBg && VALID_BACKGROUNDS.includes(storedBg as BackgroundImage)) {
          setBackgroundImageState(storedBg as BackgroundImage)
          document.documentElement.setAttribute('data-background-image', storedBg)
            // If custom background, also apply the image to the background element
          if (storedBg === 'custom') {
            const customBg = localStorage.getItem('ui.customBackgroundImage')
            if (customBg) {
                applyCustomBackgroundToDom(customBg)
            }
          }
        }
        const storedGlass = localStorage.getItem('ui.glassModals')
        setGlassModalsState(storedGlass === 'true')
        document.documentElement.setAttribute('data-glass-modals', storedGlass === 'true' ? 'true' : 'false')
        appearanceInitializedRef.current = true
      } catch (e) {
        console.warn('Failed to load org appearance:', e)
        // Fallback to localStorage
        const storedTheme = localStorage.getItem('ui.colorTheme')
        if (isValidTheme(storedTheme)) {
          setColorThemeState(storedTheme)
          document.documentElement.setAttribute('data-color-theme', storedTheme)
        }
        appearanceInitializedRef.current = true
      }
    }
    loadOrgAppearance()
  }, [])
  
  // Helper to save appearance to organization
  const saveAppearanceToOrg = (updates: { colorTheme?: string; backgroundImage?: string; glassModals?: boolean }) => {
    if (currentOrgId && appearanceInitializedRef.current) {
      ;(window as any).api?.organizations?.setAppearance?.({ orgId: currentOrgId, ...updates }).catch(() => {})
    }
  }
  
  // Wrapper to save theme to organization when changed
  const setColorTheme = (val: ColorTheme) => {
    setColorThemeState(val)
    saveAppearanceToOrg({ colorTheme: val })
  }
  
  // Wrapper to save background image to organization when changed
  const setBackgroundImage = (val: BackgroundImage) => {
    setBackgroundImageState(val)
    try {
      localStorage.setItem('ui.backgroundImage', val)
    } catch {
      // ignore
    }
    try {
      document.documentElement.setAttribute('data-background-image', val)
    } catch {
      // ignore
    }

    // Keep DOM background element in sync (avoid CSS variable limits + state race conditions)
    if (val === 'custom') {
      applyCustomBackgroundToDom(customBackgroundImage)
    } else {
      // Clear inline image so predefined backgrounds (CSS) or none can apply
      applyCustomBackgroundToDom(null)
    }

    saveAppearanceToOrg({ backgroundImage: val })
  }
  
  // Wrapper to save custom background image
  const setCustomBackgroundImage = (val: string | null) => {
    setCustomBackgroundImageState(val)
    
    // Apply custom background immediately (do NOT route through CSS variables)
    try {
      if (val) {
        applyCustomBackgroundToDom(val)
        // Ensure CSS rules for custom are active
        document.documentElement.setAttribute('data-background-image', 'custom')
      } else {
        applyCustomBackgroundToDom(null)
      }
    } catch (e) {
      console.warn('Failed to set custom background property:', e)
    }

    // Try to persist to storage
    try {
      if (val) {
        localStorage.setItem('ui.customBackgroundImage', val)
      } else {
        localStorage.removeItem('ui.customBackgroundImage')
      }
    } catch (e) {
      console.warn('Failed to save custom background image to storage:', e)
    }
  }
  
  // Wrapper to save glass modals to organization when changed
  const setGlassModals = (val: boolean) => {
    setGlassModalsState(val)
    saveAppearanceToOrg({ glassModals: val })
  }

  const [navIconColorMode, setNavIconColorMode] = useState<NavIconColorMode>(() => {
    const stored = localStorage.getItem('navIconColorMode')
    return stored === 'mono' ? 'mono' : 'color'
  })

  const [dateFormat, setDateFormat] = useState<DateFormat>(() => {
    const stored = localStorage.getItem('dateFormat')
    return stored === 'iso' ? 'iso' : 'de'
  })

  const [journalRowStyle, setJournalRowStyle] = useState<JournalRowStyle>(() => {
    const stored = localStorage.getItem('ui.journalRowStyle')
    return (stored === 'both' || stored === 'lines' || stored === 'zebra' || stored === 'none') ? stored : 'both'
  })

  const [journalRowDensity, setJournalRowDensity] = useState<JournalRowDensity>(() => {
    const stored = localStorage.getItem('ui.journalRowDensity')
    return stored === 'compact' ? 'compact' : 'normal'
  })


  useEffect(() => {
    localStorage.setItem('ui.navLayout', navLayout)
  }, [navLayout])

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', 'true')
  }, [sidebarCollapsed])

  useEffect(() => {
    localStorage.setItem('ui.colorTheme', colorTheme)
    document.documentElement.setAttribute('data-color-theme', colorTheme)
  }, [colorTheme])

  useEffect(() => {
    localStorage.setItem('navIconColorMode', navIconColorMode)
  }, [navIconColorMode])

  useEffect(() => {
    localStorage.setItem('dateFormat', dateFormat)
  }, [dateFormat])

  useEffect(() => {
    localStorage.setItem('ui.journalRowStyle', journalRowStyle)
    document.documentElement.setAttribute('data-journal-row-style', journalRowStyle)
  }, [journalRowStyle])

  useEffect(() => {
    localStorage.setItem('ui.journalRowDensity', journalRowDensity)
    document.documentElement.setAttribute('data-journal-row-density', journalRowDensity)
  }, [journalRowDensity])

  useEffect(() => {
    localStorage.setItem('ui.backgroundImage', backgroundImage)
    document.documentElement.setAttribute('data-background-image', backgroundImage)
    // Apply background image to DOM element when selected
    if (backgroundImage === 'custom') {
      applyCustomBackgroundToDom(customBackgroundImage)
    } else {
      applyCustomBackgroundToDom(null)
    }
  }, [backgroundImage, customBackgroundImage])

  useEffect(() => {
    localStorage.setItem('ui.glassModals', String(glassModals))
    document.documentElement.setAttribute('data-glass-modals', String(glassModals))
  }, [glassModals])

  return (
    <UIPreferencesContext.Provider
      value={{
        navLayout,
        setNavLayout,
        sidebarCollapsed,
        setSidebarCollapsed,
        colorTheme,
        setColorTheme,
        navIconColorMode,
        setNavIconColorMode,
        dateFormat,
        setDateFormat,
        journalRowStyle,
        setJournalRowStyle,
        journalRowDensity,
        setJournalRowDensity,
        backgroundImage,
        setBackgroundImage,
        customBackgroundImage,
        setCustomBackgroundImage,
        glassModals,
        setGlassModals
      }}
    >
      {children}
    </UIPreferencesContext.Provider>
  )
}
