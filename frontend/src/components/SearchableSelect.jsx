import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

const SearchableSelect = ({ 
  options = [], 
  value, 
  onChange, 
  name,
  placeholder = "Seleccionar...", 
  searchPlaceholder = "Buscar...",
  customOption = null,
  onCustomOptionClick = null,
  className = "",
  required = false,
  style = {}
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const dropdownRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  // Función para filtrar opciones por palabras individuales
  const filterOptions = (options, searchTerm) => {
    if (!searchTerm.trim()) return options
    
    const searchWords = searchTerm.toLowerCase().trim().split(/\s+/)
    
    return options.filter(option => {
      const optionText = option.toLowerCase()
      // Verificar que todas las palabras de búsqueda estén contenidas en la opción
      return searchWords.every(word => optionText.includes(word))
    })
  }

  const filteredOptions = filterOptions(options, searchTerm)

  // Función para calcular la posición del dropdown
  const calculateDropdownPosition = () => {
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom,
        left: rect.left,
        width: Math.max(rect.width, 200) // Ancho mínimo de 200px
      })
    }
  }

  // Recalcular posición cuando se abre el dropdown
  useEffect(() => {
    if (isOpen) {
      // Pequeño delay para asegurar que el DOM se actualice
      setTimeout(() => {
        calculateDropdownPosition()
      }, 10)
      
      // Recalcular posición en scroll y resize
      const handleScroll = () => calculateDropdownPosition()
      const handleResize = () => calculateDropdownPosition()
      
      window.addEventListener('scroll', handleScroll)
      window.addEventListener('resize', handleResize)
      
      return () => {
        window.removeEventListener('scroll', handleScroll)
        window.removeEventListener('resize', handleResize)
      }
    }
  }, [isOpen])

  // Recalcular posición cuando cambia el valor (para evitar que se mueva al seleccionar)
  useEffect(() => {
    if (isOpen) {
      // Pequeño delay para asegurar que el DOM se actualice después del cambio de valor
      setTimeout(() => {
        calculateDropdownPosition()
      }, 50)
    }
  }, [value, isOpen])

  // Cerrar dropdown cuando se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Verificar si el click está dentro del input principal
      const isInsideInput = dropdownRef.current && dropdownRef.current.contains(event.target)
      
      // Verificar si el click está dentro del dropdown (que está en un portal)
      const isInsideDropdown = event.target.closest('.select-dropdown')
      
      // Solo cerrar si no está en ninguno de los dos lugares
      if (!isInsideInput && !isInsideDropdown) {
        setIsOpen(false)
        setSearchTerm('')
        setHighlightedIndex(-1)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isOpen])

  // Manejar teclas de navegación
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault()
        setIsOpen(true)
        setHighlightedIndex(0)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        const maxIndex = filteredOptions.length - 1 + (customOption ? 1 : 0)
        setHighlightedIndex(prev => prev < maxIndex ? prev + 1 : prev)
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev)
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0) {
          if (customOption && highlightedIndex === 0) {
            handleCustomOption()
          } else {
            const optionIndex = customOption ? highlightedIndex - 1 : highlightedIndex
            if (optionIndex >= 0 && optionIndex < filteredOptions.length) {
              handleSelect(filteredOptions[optionIndex])
            }
          }
        }
        break
      case 'Escape':
        setIsOpen(false)
        setSearchTerm('')
        setHighlightedIndex(-1)
        break
    }
  }

  // Scroll automático para la opción resaltada
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current && listRef.current.children) {
      const highlightedElement = listRef.current.children[highlightedIndex]
      if (highlightedElement && typeof highlightedElement.scrollIntoView === 'function') {
        try {
          highlightedElement.scrollIntoView({
            block: 'nearest',
            behavior: 'smooth'
          })
        } catch (error) {
          console.warn('Error en scroll automático:', error)
        }
      }
    }
  }, [highlightedIndex])

  const handleSelect = (option) => {
    onChange({ target: { name: name, value: option } })
    setIsOpen(false)
    setSearchTerm('')
    setHighlightedIndex(-1)
  }

  const handleCustomOption = () => {
    if (onCustomOptionClick) {
      onCustomOptionClick()
    }
    setIsOpen(false)
    setSearchTerm('')
    setHighlightedIndex(-1)
  }

  const handleInputClick = () => {
    setIsOpen(!isOpen)
    if (!isOpen) {
      setHighlightedIndex(0)
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
        }
      }, 0)
    }
  }

  const displayValue = value || placeholder

  return (
    <div 
      ref={dropdownRef} 
      className={`searchable-select ${className} ${!value && required ? 'field-required' : ''}`}
      style={{ position: 'relative', minWidth: '200px', width: '100%', ...style }}
    >
      {/* Input principal que muestra la selección actual */}
      <div
        onClick={handleInputClick}
        className="select-input"
      >
        <span className={value ? 'select-value' : 'select-placeholder'}>
          {displayValue}
        </span>
        <span className={`select-arrow ${isOpen ? 'open' : ''}`}>
          ▼
        </span>
      </div>

      {/* Dropdown con búsqueda usando portal */}
      {isOpen && createPortal(
        <div
          className="select-dropdown"
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            zIndex: 99999
          }}
        >
          {/* Input de búsqueda */}
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setHighlightedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder={searchPlaceholder}
            className="search-input"
            autoFocus
          />

          {/* Lista de opciones */}
          <div
            ref={listRef}
            className="options-list"
          >
            {filteredOptions.length === 0 && !customOption ? (
              <div style={{ 
                padding: '12px', 
                color: '#999', 
                fontStyle: 'italic',
                textAlign: 'center'
              }}>
                No se encontraron resultados
              </div>
            ) : (
              <>
                {/* Opción personalizada - PRIMERA */}
                {customOption && (
                  <div
                    onClick={handleCustomOption}
                    className={`option ${0 === highlightedIndex ? 'highlighted' : ''}`}
                    style={{ fontStyle: 'italic', color: '#666', borderBottom: '1px solid #ddd' }}
                    onMouseEnter={() => setHighlightedIndex(0)}
                  >
                    {customOption}
                  </div>
                )}
                
                {filteredOptions.map((option, index) => (
                  <div
                    key={`option-${index}`}
                    onClick={() => handleSelect(option)}
                    className={`option ${(customOption ? index + 1 : index) === highlightedIndex ? 'highlighted' : ''} ${value === option ? 'selected' : ''}`}
                    onMouseEnter={() => setHighlightedIndex(customOption ? index + 1 : index)}
                  >
                    {option}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default SearchableSelect
