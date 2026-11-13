### Task 2: `LocationPickerMap` component

**Files:**
- Create: `frontend/src/components/logistics/LocationPickerMap.tsx`
- Modify: `frontend/src/index.css` (import maplibre CSS if not imported in the component)

**Interfaces:**
- Consumes: `DEVLABS_MAP_STYLE`, `JAMAICA_MAX_BOUNDS`, `DEFAULT_JAMAICA_CENTER`, `DEFAULT_MAP_ZOOM` from `../../lib/mapStyle`
- Produces: `LocationPickerMap` React component

```ts
export type MapLatLng = { lat: number; lng: number }

export function LocationPickerMap(props: {
  lat?: number | null
  lng?: number | null
  onLocationChange: (coords: MapLatLng) => void
  className?: string
}): JSX.Element
```

Behavior:
- Mount MapLibre on a div ref; destroy on unmount
- Center: `[lng, lat]` if both finite, else `DEFAULT_JAMAICA_CENTER`
- Draggable `Marker`; `dragend` â†’ `onLocationChange`
- Map `click` moves marker and calls `onLocationChange`
- When `lat`/`lng` props change from parent (e.g. geolocation), `setLngLat` without re-creating the map
- `minZoom: 8.5`, `maxBounds: JAMAICA_MAX_BOUNDS`, `pitch: 0`, `dragRotate: false`

- [ ] **Step 1: Implement component**

Create `frontend/src/components/logistics/LocationPickerMap.tsx`:

```tsx
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import {
  DEFAULT_JAMAICA_CENTER,
  DEFAULT_MAP_ZOOM,
  DEVLABS_MAP_STYLE,
  JAMAICA_MAX_BOUNDS,
} from '../../lib/mapStyle'

export type MapLatLng = { lat: number; lng: number }

function isFiniteCoord(lat: unknown, lng: unknown): lat is number {
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
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const onChangeRef = useRef(onLocationChange)
  onChangeRef.current = onLocationChange

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const initial = isFiniteCoord(lat, lng) ? ([lng, lat] as [number, number]) : DEFAULT_JAMAICA_CENTER
    const map = new maplibregl.Map({
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
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    const marker = new maplibregl.Marker({ draggable: true, color: '#E8B923' })
      .setLngLat(initial)
      .addTo(map)

    marker.on('dragend', () => {
      const { lng: nextLng, lat: nextLat } = marker.getLngLat()
      onChangeRef.current({ lat: nextLat, lng: nextLng })
    })

    map.on('click', (e) => {
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
    const current = markerRef.current.getLngLat()
    if (Math.abs(current.lat - lat) < 1e-7 && Math.abs(current.lng - lng) < 1e-7) return
    markerRef.current.setLngLat([lng, lat])
    mapRef.current.easeTo({ center: [lng, lat] })
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

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npx tsc --noEmit -p tsconfig.app.json
```

Expected: PASS for new component.

- [ ] **Step 3: Skip commit** unless the user asks

---


