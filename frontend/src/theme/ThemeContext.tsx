import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const storageKey = 'bookease-theme'
const ThemeContext = createContext<ThemeContextValue | null>(null)

function getInitialTheme(): Theme {
  const savedTheme = window.localStorage.getItem(storageKey)
  if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    window.localStorage.setItem(storageKey, theme)
  }, [theme])

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    toggleTheme: () => setTheme((currentTheme) => currentTheme === 'light' ? 'dark' : 'light'),
  }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function ThemeToggle() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('ThemeToggle must be used within ThemeProvider')

  const nextTheme = context.theme === 'light' ? 'dark' : 'light'
  const label = `Switch to ${nextTheme} mode`

  return (
    <button
      className="theme-toggle no-print"
      type="button"
      aria-label={label}
      title={label}
      onClick={context.toggleTheme}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {context.theme === 'light'
          ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></>
          : <path d="M20.2 15.4A8.6 8.6 0 0 1 8.6 3.8 8.7 8.7 0 1 0 20.2 15.4Z" />}
      </svg>
      <span>{context.theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
    </button>
  )
}
