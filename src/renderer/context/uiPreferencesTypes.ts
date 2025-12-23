export type NavLayout = 'top' | 'left'
export type ColorTheme =
  | 'default'
  | 'fiery-ocean'
  | 'peachy-delight'
  | 'pastel-dreamland'
  | 'ocean-breeze'
  | 'earthy-tones'
  | 'monochrome-harmony'
  | 'vintage-charm'
export type NavIconColorMode = 'color' | 'mono'
export type DateFormat = 'de' | 'iso'
export type JournalRowStyle = 'both' | 'lines' | 'zebra' | 'none'
export type JournalRowDensity = 'normal' | 'compact'
export type BackgroundImage = 'none' | 'mountain-clouds' | 'snowy-landscape' | 'snow-houses'

export interface UIPreferencesContextValue {
  navLayout: NavLayout
  setNavLayout: (val: NavLayout) => void
  sidebarCollapsed: boolean
  setSidebarCollapsed: (val: boolean) => void
  colorTheme: ColorTheme
  setColorTheme: (val: ColorTheme) => void
  navIconColorMode: NavIconColorMode
  setNavIconColorMode: (val: NavIconColorMode) => void
  dateFormat: DateFormat
  setDateFormat: (val: DateFormat) => void
  journalRowStyle: JournalRowStyle
  setJournalRowStyle: (val: JournalRowStyle) => void
  journalRowDensity: JournalRowDensity
  setJournalRowDensity: (val: JournalRowDensity) => void
  backgroundImage: BackgroundImage
  setBackgroundImage: (val: BackgroundImage) => void
  glassModals: boolean
  setGlassModals: (val: boolean) => void
}
