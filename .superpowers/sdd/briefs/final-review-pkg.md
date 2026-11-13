# Final review package — local delivery map picker (uncommitted)

## Files
- frontend/package.json (maplibre-gl, protomaps-themes-base)
- frontend/src/lib/mapStyle.ts
- frontend/src/types/protomaps-themes-base.d.ts
- frontend/src/components/logistics/LocationPickerMap.tsx
- frontend/src/components/logistics/LocalDeliveryBookingForm.tsx (map wiring)

## Spec
docs/superpowers/specs/2026-11-11-local-delivery-map-picker-design.md

## Plan
docs/superpowers/plans/2026-11-11-local-delivery-map-picker.md

## Ledger minors
- attribution encoding may show wrong copyright glyph
- geocode race on rapid pin drag
- GPS can overwrite pin while locating
- stale parent coords if geocode fails
- manual browser QA not fully done by implementers

## mapStyle.ts
```ts
import { layers } from 'protomaps-themes-base'
import type { StyleSpecification } from 'maplibre-gl'

const MAPS_HOST = (import.meta.env.VITE_MAPS_HOST as string | undefined)?.trim() || 'https://maps.devlabsja.com'
const MAPS_API_KEY =
  (import.meta.env.VITE_MAPS_API_KEY as string | undefined)?.trim() ||
  'op_live_cb6f84075836822c950bd3b5e4eec57376b3b6e8aaee0696'

export type MapTheme = 'light' | 'dark'

export const JAMAICA_MAX_BOUNDS: [[number, number], [number, number]] = [
  [-78.5, 17.6],
  [-76.1, 18.6],
]

export const DEFAULT_JAMAICA_CENTER: [number, number] = [-76.7936, 18.0179]
export const DEFAULT_MAP_ZOOM = 12

export function getDevLabsMapStyle(theme: MapTheme = 'light'): StyleSpecification {
  const tileJsonUrl = `${MAPS_HOST.replace(/\/$/, '')}/api?key=${MAPS_API_KEY}`
  return {
    version: 8,
    glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sources: {
      protomaps: {
        type: 'vector',
        url: tileJsonUrl,
        attribution:
          '<a href="https://maps.devlabsja.com">DevLabsJa Maps</a> Ã‚Â© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    },
    layers: layers('protomaps', theme, 'en'),
  }
}

export const DEVLABS_MAP_STYLE = getDevLabsMapStyle('light')
```

## LocationPickerMap.tsx
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

## LocalDeliveryBookingForm map-related excerpts

> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:6:  lookupBossDeliveryTarget,
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:7:  reverseGeocode,
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:8:  type BossDeliveryPreview,
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:9:  type LogisticsItemCategory,
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:10:} from '../../api/logisticsJobs'
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:14:import { LocationPickerMap, type MapLatLng } from 
'./LocationPickerMap'
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:15:
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:16:type PickupMode = 'saved' | 'near_me' | 'manual'
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:17:type DropoffMode = 'saved' | 'manual' | 'boss'
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:18:
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:19:const ITEM_OPTIONS: { value: 
LogisticsItemCategory; label: string }[] = [
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:52:              ? 'bg-boss-gold text-black'
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:53:              : 'bg-background text-muted 
hover:text-foreground'
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:54:          }`}
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:74:  const [pickupManual, setPickupManual] = 
useState({
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:75:    line1: '',
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:76:    community: '',
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:79:  const [dropoffManual, setDropoffManual] = 
useState({
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:80:    line1: '',
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:81:    community: '',
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:91:  const [pickupCoords, setPickupCoords] = 
useState<MapLatLng | null>(null)
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:92:  const [dropoffCoords, setDropoffCoords] = 
useState<MapLatLng | null>(null)
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:93:  const [geocodingPickup, setGeocodingPickup] = 
useState(false)
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:94:  const [geocodingDropoff, setGeocodingDropoff] = 
useState(false)
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:95:  const [bossIdInput, setBossIdInput] = 
useState('')
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:96:  const [bossPreview, setBossPreview] = 
useState<BossDeliveryPreview | null>(null)
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:97:  const [lookingUpBoss, setLookingUpBoss] = 
useState(false)
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:98:  const [itemCategory, setItemCategory] = 
useState<LogisticsItemCategory>('food')
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:99:  const [itemOther, setItemOther] = useState('')
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:111:  async function applyReverseGeocode(side: 
'pickup' | 'dropoff', coords: MapLatLng) {
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:112:    const setBusy = side === 'pickup' ? 
setGeocodingPickup : setGeocodingDropoff
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:113:    setBusy(true)
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:120:        if (pickupMode === 'near_me') {
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:121:          setNearMe({
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:122:            line1: result.line1,
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:128:          setPickupManual({
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:129:            line1: result.line1,
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:130:            community: result.community ?? '',
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:134:        setPickupCoords(coords)
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:135:      } else {
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:136:        setDropoffManual({
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:137:          line1: result.line1,
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:138:          community: result.community ?? '',
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:141:        setDropoffCoords(coords)
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:142:      }
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:143:    } catch (err) {
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:154:      if (code === 2) return 'Location 
unavailable. Try again or enter the address manually.'
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:155:      if (code === 3) return 'Location timed out. 
Try again or enter the address manually.'
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:156:    }
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:157:    return getErrorMessage(err) || 'Could not get 
your location'
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:160:  async function handleUseMyLocation() {
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:161:    setError('')
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:162:    setLocating(true)
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:176:      setPickupCoords(gpsCoords)
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:177:      const result = await 
reverseGeocode(gpsCoords.lat, gpsCoords.lng)
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:178:      setNearMe({
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:195:    if (mode === 'near_me') {
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:196:      void handleUseMyLocation()
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:197:    }
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:198:  }
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:200:  async function handleBossLookup() {
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:201:    setError('')
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:202:    setBossPreview(null)
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:203:    setLookingUpBoss(true)
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:204:    try {
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:205:      const preview = await 
lookupBossDeliveryTarget(bossIdInput)
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:206:      setBossPreview(preview)
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:207:    } catch (err) {
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:208:      setError(getErrorMessage(err))
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:210:      setLookingUpBoss(false)
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:211:    }
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:212:  }
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:230:      } else if (pickupMode === 'near_me') {
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:231:        if (!nearMe.ready || 
!nearMe.line1.trim()) {
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:232:          throw new Error('Use your current 
location first')
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:243:        if (!pickupManual.line1.trim()) throw new 
Error('Enter a pickup address')
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:244:        pickup_address = {
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:245:          label: 'Pickup',
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:246:          line1: pickupManual.line1.trim(),
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:247:          community: 
pickupManual.community.trim() || undefined,
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:248:          parish: pickupManual.parish,
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:249:          contact_number: contactNumber,
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:250:          is_default: false,
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:256:      let dropoff_boss_id: string | undefined
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:257:      if (dropoffMode === 'boss') {
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:258:        if (!bossPreview) throw new Error('Look 
up a BOSS ID first')
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:259:        dropoff_boss_id = bossPreview.shipping_id
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:260:      } else if (dropoffMode === 'saved') {
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:261:        if (!dropoffAddressId) throw new 
Error('Choose a drop-off address')
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:264:        if (!dropoffManual.line1.trim()) throw 
new Error('Enter a drop-off address')
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:265:        dropoff_address = {
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:266:          label: 'Drop-off',
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:267:          line1: dropoffManual.line1.trim(),
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:268:          community: 
dropoffManual.community.trim() || undefined,
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:269:          parish: dropoffManual.parish,
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:270:          contact_number: contactNumber,
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:271:          is_default: false,
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:280:        dropoff_boss_id,
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:281:        item_category: itemCategory,
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:282:        item_other_detail: itemCategory === 
'other' ? itemOther.trim() : undefined,
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:290:      setBossPreview(null)
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:291:      setBossIdInput('')
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:292:      setNotes('')
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:293:      void refreshAll()
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:330:            { value: 'near_me', label: 'Near me' 
},
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:331:            { value: 'manual', label: 'Enter' },
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:332:          ]}
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:333:        />
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:348:        {pickupMode === 'near_me' && (
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:349:          <div className="space-y-2">
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:350:            <Button
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:354:              onClick={() => void 
handleUseMyLocation()}
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:355:              disabled={locating}
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:356:            >
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:362:            <LocationPickerMap
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:363:              lat={pickupCoords?.lat}
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:364:              lng={pickupCoords?.lng}
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:365:              onLocationChange={(coords) => void 
applyReverseGeocode('pickup', coords)}
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:366:            />
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:367:            {locating && (
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:402:        {pickupMode === 'manual' && (
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:403:          <div className="space-y-2">
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:404:            <LocationPickerMap
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:405:              lat={pickupCoords?.lat}
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:406:              lng={pickupCoords?.lng}
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:407:              onLocationChange={(coords) => void 
applyReverseGeocode('pickup', coords)}
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:408:            />
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:409:            {geocodingPickup && <p 
className="text-xs text-muted">Updating address from map…</p>}
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:411:              value={pickupManual.line1}
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:412:              onChange={(e) => 
setPickupManual((s) => ({ ...s, line1: e.target.value }))}
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:413:              placeholder="Street / place"
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:414:              className="w-full rounded-lg border 
border-border bg-background px-3 py-2.5 text-sm"
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:417:              value={pickupManual.community}
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:418:              onChange={(e) => 
setPickupManual((s) => ({ ...s, community: e.target.value }))}
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:419:              placeholder="Community (optional)"
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:420:              className="w-full rounded-lg border 
border-border bg-background px-3 py-2.5 text-sm"
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:423:              value={pickupManual.parish}
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:424:              onChange={(e) => 
setPickupManual((s) => ({ ...s, parish: e.target.value }))}
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:425:              className="w-full rounded-lg border 
border-border bg-background px-3 py-2.5 text-sm"
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:426:            >
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:444:            { value: 'manual', label: 'Enter' },
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:445:            { value: 'boss', label: 'Boss ID' },
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:446:          ]}
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:447:        />
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:462:        {dropoffMode === 'manual' && (
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:463:          <div className="space-y-2">
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:464:            <LocationPickerMap
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:465:              lat={dropoffCoords?.lat}
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:466:              lng={dropoffCoords?.lng}
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:467:              onLocationChange={(coords) => void 
applyReverseGeocode('dropoff', coords)}
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:468:            />
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:469:            {geocodingDropoff && <p 
className="text-xs text-muted">Updating address from map…</p>}
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:471:              value={dropoffManual.line1}
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:472:              onChange={(e) => 
setDropoffManual((s) => ({ ...s, line1: e.target.value }))}
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:473:              placeholder="Street / place"
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:474:              className="w-full rounded-lg border 
border-border bg-background px-3 py-2.5 text-sm"
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:477:              value={dropoffManual.community}
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:478:              onChange={(e) => 
setDropoffManual((s) => ({ ...s, community: e.target.value }))}
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:479:              placeholder="Community (optional)"
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:480:              className="w-full rounded-lg border 
border-border bg-background px-3 py-2.5 text-sm"
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:483:              value={dropoffManual.parish}
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:484:              onChange={(e) => 
setDropoffManual((s) => ({ ...s, parish: e.target.value }))}
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:485:              className="w-full rounded-lg border 
border-border bg-background px-3 py-2.5 text-sm"
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:486:            >
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:495:        {dropoffMode === 'boss' && (
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:496:          <div className="space-y-2">
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:497:            <div className="flex gap-2">
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:499:                value={bossIdInput}
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:500:                onChange={(e) => 
setBossIdInput(e.target.value)}
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:501:                placeholder="BOSS-90016"
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:502:                className="min-w-0 flex-1 
rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-sm"
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:503:              />
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:507:                onClick={() => void 
handleBossLookup()}
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:508:                disabled={lookingUpBoss || 
!bossIdInput.trim()}
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:509:              >
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:510:                {lookingUpBoss ? '…' : 'Lookup'}
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:511:              </Button>
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:512:            </div>
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:513:            {bossPreview && (
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:514:              <p className="rounded-xl border 
border-boss-gold/30 bg-boss-gold/10 px-3 py-2.5 text-sm text-foreground">
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:515:                Deliver to <span 
className="font-semibold">{bossPreview.first_name}</span>
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:516:                {(bossPreview.community || 
bossPreview.parish) && (
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:517:                  <>
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:518:                    {' '}
> frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:519:                    · {[bossPreview.community, 
bossPreview.parish].filter(Boolean).join(', ')}
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:520:                  </>
  frontend\src\components\logistics\LocalDeliveryBookingForm.tsx:521:                )}{' '}



