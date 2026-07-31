const THEME_STORAGE_KEY = 'earas-theme'

export function getStoredTheme(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY)
  } catch {
    return null
  }
}

export function setStoredTheme(theme: string): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage unavailable — theme falls back to system preference
  }
}

export function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function resolveTheme(theme: string): 'light' | 'dark' {
  if (theme === 'system') return getSystemTheme()
  return theme === 'dark' ? 'dark' : 'light'
}

export function applyThemeClass(resolved: 'light' | 'dark'): void {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(resolved)
}

export { THEME_STORAGE_KEY }
