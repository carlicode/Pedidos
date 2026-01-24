import { useState, useEffect, useRef } from 'react'
import { toast } from 'react-toastify'
import notificationSound from '../music/new-notification.mp3'

export const useTimer = () => {
  const [tiempoRestante, setTiempoRestante] = useState(null) // en segundos
  const [timerActivo, setTimerActivo] = useState(false)
  const [mensajeTimer, setMensajeTimer] = useState('')
  const [mostrarAlerta, setMostrarAlerta] = useState(false)
  const intervalRef = useRef(null)
  const audioRef = useRef(null)
  const sonidosReproducidos = useRef(0)

  // Inicializar audio
  useEffect(() => {
    if (audioRef.current === null) {
      audioRef.current = new Audio(notificationSound)
      audioRef.current.volume = 0.7
    }
  }, [])

  // Función para reproducir sonido 3 veces
  const reproducirSonido = () => {
    if (sonidosReproducidos.current < 3 && audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(error => {
        console.error('Error reproduciendo sonido:', error)
      })
      sonidosReproducidos.current += 1
      
      // Reproducir el siguiente sonido después de 1 segundo
      if (sonidosReproducidos.current < 3) {
        setTimeout(reproducirSonido, 1000)
      }
    }
  }

  // Timer countdown
  useEffect(() => {
    if (timerActivo && tiempoRestante > 0) {
      intervalRef.current = setInterval(() => {
        setTiempoRestante(prev => {
          if (prev <= 1) {
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [timerActivo, tiempoRestante])

  // Activar alerta cuando el timer llega a 0
  useEffect(() => {
    if (timerActivo && tiempoRestante === 0) {
      setTimerActivo(false)
      setMostrarAlerta(true)
      sonidosReproducidos.current = 0
      reproducirSonido()
      
      // Mostrar notificación toast
      toast.info(mensajeTimer || '⏰ ¡Tiempo completado!', {
        autoClose: false,
        position: 'top-center'
      })
    }
  }, [tiempoRestante, timerActivo, mensajeTimer])

  const iniciarTimer = (minutos, segundos, mensaje) => {
    const min = parseInt(minutos) || 0
    const seg = parseInt(segundos) || 0
    const totalSegundos = min * 60 + seg

    if (totalSegundos <= 0) {
      toast.error('Por favor ingresa un tiempo válido')
      return false
    }

    if (!mensaje || !mensaje.trim()) {
      toast.error('Por favor ingresa un mensaje para el recordatorio')
      return false
    }

    setTiempoRestante(totalSegundos)
    setTimerActivo(true)
    setMensajeTimer(mensaje.trim())
    setMostrarAlerta(false)
    sonidosReproducidos.current = 0
    toast.success(`⏰ Timer iniciado: ${min} min ${seg} seg`)
    return true
  }

  const detenerTimer = () => {
    setTimerActivo(false)
    setTiempoRestante(null)
    setMostrarAlerta(false)
    setMensajeTimer('')
    sonidosReproducidos.current = 0
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    toast.info('Timer detenido')
  }

  const cerrarAlerta = () => {
    setMostrarAlerta(false)
    sonidosReproducidos.current = 0
  }

  const formatearTiempo = (segundos) => {
    if (segundos === null || segundos === undefined) return '00:00'
    const min = Math.floor(segundos / 60)
    const seg = segundos % 60
    return `${min.toString().padStart(2, '0')}:${seg.toString().padStart(2, '0')}`
  }

  return {
    tiempoRestante,
    timerActivo,
    mensajeTimer,
    mostrarAlerta,
    iniciarTimer,
    detenerTimer,
    cerrarAlerta,
    formatearTiempo
  }
}

