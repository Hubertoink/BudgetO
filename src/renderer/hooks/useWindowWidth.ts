import { useState, useEffect } from 'react'

/**
 * Tracks the current window inner width, updating on resize.
 * Uses a debounced resize listener to avoid excessive re-renders.
 */
export function useWindowWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth)

  useEffect(() => {
    let rafId: number | null = null

    const handleResize = () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        setWidth(window.innerWidth)
        rafId = null
      })
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [])

  return width
}
