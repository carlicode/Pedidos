import React, { useState } from 'react'

/**
 * Componente de calendario con selección múltiple de fechas
 * @param {Array} selectedDates - Array de fechas seleccionadas en formato ISO (YYYY-MM-DD)
 * @param {Function} onDateSelect - Callback cuando se selecciona/deselecciona una fecha
 * @param {string} minDate - Fecha mínima seleccionable en formato ISO (YYYY-MM-DD)
 */
export default function MultiDateCalendar({ selectedDates, onDateSelect, minDate }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const today = new Date()
  
  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    
    const days = []
    
    // Días del mes anterior (para completar la semana)
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i)
      days.push({
        date: prevDate,
        isCurrentMonth: false,
        isSelectable: false
      })
    }
    
    // Días del mes actual
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      const isPast = date < new Date(minDate || today.toISOString().split('T')[0])
      days.push({
        date,
        isCurrentMonth: true,
        isSelectable: !isPast,
        isToday: date.toDateString() === today.toDateString()
      })
    }
    
    // Días del mes siguiente (para completar la semana)
    const remainingDays = 42 - days.length // 6 semanas * 7 días
    for (let day = 1; day <= remainingDays; day++) {
      const nextDate = new Date(year, month + 1, day)
      days.push({
        date: nextDate,
        isCurrentMonth: false,
        isSelectable: false
      })
    }
    
    return days
  }
  
  const navigateMonth = (direction) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev)
      newDate.setMonth(prev.getMonth() + direction)
      return newDate
    })
  }
  
  const handleDateClick = (date) => {
    const dateString = date.toISOString().split('T')[0]
    onDateSelect(dateString)
  }
  
  const isDateSelected = (date) => {
    const dateString = date.toISOString().split('T')[0]
    return selectedDates.includes(dateString)
  }
  
  const days = getDaysInMonth(currentMonth)
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  
  return (
    <div className="multi-date-calendar">
      {/* Header del calendario */}
      <div className="calendar-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
        padding: '0 4px'
      }}>
        <button
          type="button"
          onClick={() => navigateMonth(-1)}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '16px',
            cursor: 'pointer',
            padding: '2px 6px',
            borderRadius: '3px',
            color: '#6c757d'
          }}
        >
          ‹
        </button>
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h4>
        <button
          type="button"
          onClick={() => navigateMonth(1)}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '16px',
            cursor: 'pointer',
            padding: '2px 6px',
            borderRadius: '3px',
            color: '#6c757d'
          }}
        >
          ›
        </button>
      </div>
      
      {/* Días de la semana */}
      <div className="calendar-weekdays" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '1px',
        marginBottom: '6px'
      }}>
        {dayNames.map(day => (
          <div key={day} style={{
            textAlign: 'center',
            fontSize: '10px',
            fontWeight: '600',
            color: '#6c757d',
            padding: '4px 2px'
          }}>
            {day}
          </div>
        ))}
      </div>
      
      {/* Días del calendario */}
      <div className="calendar-days" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '1px'
      }}>
        {days.map((day, index) => (
          <button
            key={index}
            type="button"
            onClick={() => day.isSelectable && handleDateClick(day.date)}
            disabled={!day.isSelectable}
            style={{
              aspectRatio: '1',
              border: day.isToday && !isDateSelected(day.date) ? '1px solid #007bff' : '1px solid #e9ecef',
              borderRadius: '3px',
              fontSize: '12px',
              cursor: day.isSelectable ? 'pointer' : 'default',
              backgroundColor: !day.isSelectable 
                ? '#f8f9fa'
                : isDateSelected(day.date)
                  ? '#007bff'
                  : day.isToday
                    ? '#e3f2fd'
                    : 'white',
              color: !day.isSelectable
                ? '#adb5bd'
                : isDateSelected(day.date)
                  ? 'white'
                  : day.isToday
                    ? '#007bff'
                    : '#212529',
              fontWeight: day.isToday ? 'bold' : 'normal',
              transition: 'all 0.2s ease',
              minHeight: '28px'
            }}
            onMouseEnter={(e) => {
              if (day.isSelectable && !isDateSelected(day.date)) {
                e.target.style.backgroundColor = '#f8f9fa'
              }
            }}
            onMouseLeave={(e) => {
              if (day.isSelectable && !isDateSelected(day.date)) {
                e.target.style.backgroundColor = day.isToday ? '#e3f2fd' : 'white'
              }
            }}
          >
            {day.date.getDate()}
          </button>
        ))}
      </div>
      
      {/* Leyenda */}
      <div style={{
        marginTop: '8px',
        fontSize: '10px',
        color: '#6c757d',
        textAlign: 'center'
      }}>
        💡 Haz clic en las fechas para seleccionarlas
      </div>
    </div>
  )
}

