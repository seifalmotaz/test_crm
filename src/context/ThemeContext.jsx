import { createContext, useContext, useState, useLayoutEffect } from 'react'

const ThemeContext = createContext(null)

const ACCENT_NAMES = ['blue', 'violet', 'emerald', 'rose', 'amber', 'cyan']
// Bumped key forces a fresh default on existing installs after the PIN CRM rebrand.
const ACCENT_KEY = 'pin_crm_accent_v2'
const THEME_KEY  = 'pin_crm_theme_v2'

function applyAccent(a) {
  const root = document.documentElement
  ACCENT_NAMES.forEach(c => root.classList.remove(`accent-${c}`))
  // Brand red (#E53935) is the default — defined in :root, no class needed.
  if (a !== 'red') root.classList.add(`accent-${a}`)
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY) || 'dark'
    if (saved === 'light') document.documentElement.classList.add('light')
    return saved
  })

  const [accent, setAccentState] = useState(() => {
    const saved = localStorage.getItem(ACCENT_KEY) || 'red'
    applyAccent(saved)
    return saved
  })

  function setTheme(t) {
    setThemeState(t)
    localStorage.setItem(THEME_KEY, t)
  }

  function setAccent(a) {
    setAccentState(a)
    localStorage.setItem(ACCENT_KEY, a)
  }

  useLayoutEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }
  }, [theme])

  useLayoutEffect(() => {
    applyAccent(accent)
  }, [accent])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
