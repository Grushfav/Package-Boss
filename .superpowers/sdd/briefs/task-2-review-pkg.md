# Task 2 review package (uncommitted)

## NEW FILE LocationPickerMap.tsx
```tsx
import { Map, Marker, NavigationControl } from 'maplibre-gl'
import type { MapMouseEvent } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import {
  DEFAULT_JAMAICA_CENTER,
  DEFAULT_MAP_ZOOM,
  DEVLABS_MAP_STYLE,
  JAMAICA_MAX_BOUNDS,
} from '../../lib/mapStyle'

export type MapLatLng = { lat: number; lng: number }

function isFiniteCoord(lat: unknown, lng: unknown): boolean {
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)
}

export function LocationPickerMap({
  lat,
  lng,
  onLocationChange,
  className,
}: {
  lat?: number | null
  lng?: number | null
  onLocationChange: (coords: MapLatLng) => void
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<Map | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const onChangeRef = useRef(onLocationChange)
  onChangeRef.current = onLocationChange

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const initial = isFiniteCoord(lat, lng) ? ([lng, lat] as [number, number]) : DEFAULT_JAMAICA_CENTER
    const map = new Map({
      container: containerRef.current,
      style: DEVLABS_MAP_STYLE,
      center: initial,
      zoom: DEFAULT_MAP_ZOOM,
      minZoom: 8.5,
      maxBounds: JAMAICA_MAX_BOUNDS,
      pitch: 0,
      dragRotate: false,
      attributionControl: { compact: true },
    })
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')

    const marker = new Marker({ draggable: true, color: '#E8B923' })
      .setLngLat(initial)
      .addTo(map)

    marker.on('dragend', () => {
      const { lng: nextLng, lat: nextLat } = marker.getLngLat()
      onChangeRef.current({ lat: nextLat, lng: nextLng })
    })

    map.on('click', (e: MapMouseEvent) => {
      marker.setLngLat(e.lngLat)
      onChangeRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    })

    mapRef.current = map
    markerRef.current = marker

    return () => {
      marker.remove()
      map.remove()
      markerRef.current = null
      mapRef.current = null
    }
    // Intentionally mount once; prop sync is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isFiniteCoord(lat, lng) || !markerRef.current || !mapRef.current) return
    const syncLat = lat as number
    const syncLng = lng as number
    const current = markerRef.current.getLngLat()
    if (Math.abs(current.lat - syncLat) < 1e-7 && Math.abs(current.lng - syncLng) < 1e-7) return
    markerRef.current.setLngLat([syncLng, syncLat])
    mapRef.current.easeTo({ center: [syncLng, syncLat] })
  }, [lat, lng])

  return (
    <div
      ref={containerRef}
      className={`h-56 w-full overflow-hidden rounded-lg border border-border ${className ?? ''}`}
      role="application"
      aria-label="Location picker map"
    />
  )
}
```
