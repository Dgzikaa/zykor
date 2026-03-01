'use client'

import confetti from 'canvas-confetti'

// Tipos de efeitos de confetti
export type ConfettiType = 'celebration' | 'stars' | 'sparkle' | 'burst' | 'rain'

// Cores temáticas
const COLORS = {
  gold: ['#FFD700', '#FFA500', '#FFB347'],
  party: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96E6A1', '#DDA0DD'],
  firework: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'],
  newyear: ['#FFD700', '#C0C0C0', '#FFFFFF', '#FF6B6B', '#4ECDC4'],
}

// Função para disparar confetti em uma posição específica
export function triggerConfetti(
  x: number = 0.5,
  y: number = 0.5,
  type: ConfettiType = 'celebration'
) {
  switch (type) {
    case 'celebration':
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { x, y },
        colors: COLORS.party,
        zIndex: 9999,
      })
      break

    case 'stars':
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { x, y },
        colors: COLORS.gold,
        shapes: ['star'],
        zIndex: 9999,
      })
      break

    case 'sparkle':
      confetti({
        particleCount: 30,
        spread: 50,
        origin: { x, y },
        colors: COLORS.newyear,
        scalar: 0.8,
        gravity: 0.8,
        zIndex: 9999,
      })
      break

    case 'burst': {
      // Explosão em múltiplas direções
      const burst = () => {
        confetti({
          particleCount: 40,
          angle: 60,
          spread: 55,
          origin: { x, y },
          colors: COLORS.firework,
          zIndex: 9999,
        })
        confetti({
          particleCount: 40,
          angle: 120,
          spread: 55,
          origin: { x, y },
          colors: COLORS.firework,
          zIndex: 9999,
        })
      }
      burst()
      break
    }

    case 'rain':
      confetti({
        particleCount: 80,
        spread: 100,
        origin: { x, y: y - 0.2 },
        colors: COLORS.newyear,
        gravity: 1.2,
        drift: 0,
        zIndex: 9999,
      })
      break
  }
}

// Função para disparar confetti a partir de um evento de clique
export function triggerConfettiFromEvent(
  event: React.MouseEvent,
  type: ConfettiType = 'sparkle'
) {
  const rect = (event.target as HTMLElement).getBoundingClientRect()
  const x = (rect.left + rect.width / 2) / window.innerWidth
  const y = (rect.top + rect.height / 2) / window.innerHeight
  
  triggerConfetti(x, y, type)
}

// Dispara confetti dos cantos (tipo Réveillon)
export function triggerNewYearConfetti() {
  const duration = 3000
  const animationEnd = Date.now() + duration
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 }

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min
  }

  const interval = setInterval(function() {
    const timeLeft = animationEnd - Date.now()

    if (timeLeft <= 0) {
      clearInterval(interval)
      return
    }

    const particleCount = 50 * (timeLeft / duration)
    
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      colors: COLORS.newyear,
    })
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      colors: COLORS.newyear,
    })
  }, 250)

  // Explosão central
  confetti({
    particleCount: 150,
    spread: 120,
    origin: { y: 0.6 },
    colors: COLORS.newyear,
    zIndex: 9999,
  })
}

// Hook customizado para adicionar confetti a um elemento
export function useConfettiClick(type: ConfettiType = 'sparkle') {
  return (event: React.MouseEvent) => {
    triggerConfettiFromEvent(event, type)
  }
}
