import { useEffect, useRef } from 'react'

/**
 * Runs a callback on an interval only while the browser tab is visible.
 * Refreshes once when the tab becomes visible again.
 */
export function useVisibleInterval(callback: () => void, delayMs: number) {
  const savedCallback = useRef(callback)
  savedCallback.current = callback

  useEffect(() => {
    let intervalId: number | undefined

    const tick = () => savedCallback.current()

    const start = () => {
      if (intervalId !== undefined) return
      tick()
      intervalId = window.setInterval(tick, delayMs)
    }

    const stop = () => {
      if (intervalId === undefined) return
      window.clearInterval(intervalId)
      intervalId = undefined
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        start()
      } else {
        stop()
      }
    }

    if (document.visibilityState === 'visible') {
      start()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [delayMs])
}
