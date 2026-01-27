import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  // Por defecto siempre light mode. Solo usa guardado si existe.
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('ui.theme')
    if (savedTheme === 'dark' || savedTheme === 'light') return savedTheme
    return 'light'
  })

  // Aplicar tema al DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('ui.theme', theme)
    
    // Agregar clase para transiciones
    document.documentElement.classList.add('theme-transition')
  }, [theme])

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'dark' ? 'light' : 'dark'))
  }

  const value = {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === 'dark'
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme debe usarse dentro de ThemeProvider')
  }
  return context
}
