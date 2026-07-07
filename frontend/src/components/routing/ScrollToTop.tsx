import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Reset scroll position when navigating between routes (SPA default keeps scroll). */
export function ScrollToTop() {
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}
