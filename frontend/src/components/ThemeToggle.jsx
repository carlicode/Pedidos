import { useTheme } from '../contexts/ThemeContext.jsx'
import '../styles/ThemeToggle.css'

export default function ThemeToggle({ showLabel = true, size = 'medium' }) {
  const { theme, toggleTheme, isDark } = useTheme()

  const sizeClasses = {
    small: 'toggle-small',
    medium: 'toggle-medium',
    large: 'toggle-large'
  }

  return (
    <button
      className={`theme-toggle ${sizeClasses[size]} ${isDark ? 'dark' : 'light'}`}
      onClick={toggleTheme}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      <span className="toggle-track">
        <span className="toggle-thumb">
          {/* Sol icon */}
          <svg className="toggle-icon sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
          
          {/* Luna icon */}
          <svg className="toggle-icon moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </span>
      </span>
      
      {showLabel && (
        <span className="toggle-label">
          {isDark ? 'Claro' : 'Oscuro'}
        </span>
      )}
    </button>
  )
}
