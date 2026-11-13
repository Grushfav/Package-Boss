# Task 3 review package (uncommitted)

## Diff LocalDeliveryBookingForm.tsx (vs HEAD if tracked)

## Grep map-related lines

14:import { LocationPickerMap, type MapLatLng } from './LocationPickerMap'
91:const [pickupCoords, setPickupCoords] = useState<MapLatLng | null>(null)
92:const [dropoffCoords, setDropoffCoords] = useState<MapLatLng | null>(null)
93:const [geocodingPickup, setGeocodingPickup] = useState(false)
94:const [geocodingDropoff, setGeocodingDropoff] = useState(false)
111:async function applyReverseGeocode(side: 'pickup' | 'dropoff', coords: MapLatLng) {
112:const setBusy = side === 'pickup' ? setGeocodingPickup : setGeocodingDropoff
134:setPickupCoords(coords)
141:setDropoffCoords(coords)
176:setPickupCoords(gpsCoords)
362:<LocationPickerMap
363:lat={pickupCoords?.lat}
364:lng={pickupCoords?.lng}
365:onLocationChange={(coords) => void applyReverseGeocode('pickup', coords)}
370:{geocodingPickup && !locating && (
404:<LocationPickerMap
405:lat={pickupCoords?.lat}
406:lng={pickupCoords?.lng}
407:onLocationChange={(coords) => void applyReverseGeocode('pickup', coords)}
409:{geocodingPickup && <p className="text-xs text-muted">Updating address from map…</p>}
464:<LocationPickerMap
465:lat={dropoffCoords?.lat}
466:lng={dropoffCoords?.lng}
467:onLocationChange={(coords) => void applyReverseGeocode('dropoff', coords)}
469:{geocodingDropoff && <p className="text-xs text-muted">Updating address from map…</p>}
