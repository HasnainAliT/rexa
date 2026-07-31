import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Theme, ThemeContextValue } from '@/types'
import {
  applyThemeClass,
  getStoredTheme,
  getSystemTheme,
  resolveTheme,
  setStoredTheme,
} from '@/utils/theme'

const ThemeContext = createContext<ThemeContextValue | null>(null)

interface ThemeProviderProps {
  children: ReactNode
  defaultTheme?: Theme
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = getStoredTheme()
    return (stored as Theme) ?? defaultTheme
  })

  const resolvedTheme = useMemo(() => resolveTheme(theme), [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    setStoredTheme(next)
  }, [])

  useEffect(() => {
    applyThemeClass(resolvedTheme)
  }, [resolvedTheme])

  useEffect(() => {
    if (theme !== 'system') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyThemeClass(getSystemTheme())
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [theme])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  )

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  )
}

export function useThemeContext(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeProvider')
  }
  return context
}
