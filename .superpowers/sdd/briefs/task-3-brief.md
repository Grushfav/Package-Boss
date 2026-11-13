### Task 3: Wire maps into `LocalDeliveryBookingForm`

**Files:**
- Modify: `frontend/src/components/logistics/LocalDeliveryBookingForm.tsx`

**Interfaces:**
- Consumes: `LocationPickerMap`, `MapLatLng`, existing `reverseGeocode`
- Produces: Near me / Enter sections that show map and fill address state from pin

State additions:

```ts
const [pickupCoords, setPickupCoords] = useState<MapLatLng | null>(null)
const [dropoffCoords, setDropoffCoords] = useState<MapLatLng | null>(null)
const [geocodingPickup, setGeocodingPickup] = useState(false)
const [geocodingDropoff, setGeocodingDropoff] = useState(false)
```

Helpers (inside component):

```ts
async function applyReverseGeocode(
  side: 'pickup' | 'dropoff',
  coords: MapLatLng,
) {
  const setBusy = side === 'pickup' ? setGeocodingPickup : setGeocodingDropoff
  setBusy(true)
  setError('')
  try {
    const result = await reverseGeocode(coords.lat, coords.lng)
    const parish =
      result.parish && parishOptions.includes(result.parish) ? result.parish : 'Kingston'
    if (side === 'pickup') {
      if (pickupMode === 'near_me') {
        setNearMe({
          line1: result.line1,
          community: result.community ?? '',
          parish,
          ready: true,
        })
      } else {
        setPickupManual({
          line1: result.line1,
          community: result.community ?? '',
          parish,
        })
      }
      setPickupCoords(coords)
    } else {
      setDropoffManual({
        line1: result.line1,
        community: result.community ?? '',
        parish,
      })
      setDropoffCoords(coords)
    }
  } catch (err) {
    setError(getErrorMessage(err))
  } finally {
    setBusy(false)
  }
}
```

Update `handleUseMyLocation` to also `setPickupCoords({ lat, lng })` from GPS before/after reverse geocode.

Near me UI: keep locate button; always show `LocationPickerMap` when mode is near_me; show fields when `nearMe.ready` OR after map geocode.

Enter (manual) UI: show `LocationPickerMap` above the three inputs; pin changes call `applyReverseGeocode('pickup' | 'dropoff', coords)`.

Drop-off Enter: same pattern with `dropoffCoords` / `dropoffManual`.

When switching away from Near me / Enter, leave coords as-is (no need to clear).

- [ ] **Step 1: Add imports + state + `applyReverseGeocode`**

Import:

```ts
import { LocationPickerMap, type MapLatLng } from './LocationPickerMap'
```

Add state and helper as above. Update `handleUseMyLocation` to set `pickupCoords` from `position.coords`.

- [ ] **Step 2: Insert maps into Near me / Enter blocks**

Pickup Near me â€” after the locate button:

```tsx
<LocationPickerMap
  lat={pickupCoords?.lat}
  lng={pickupCoords?.lng}
  onLocationChange={(coords) => void applyReverseGeocode('pickup', coords)}
/>
{(geocodingPickup || locating) && (
  <p className="text-xs text-muted">Updating address from mapâ€¦</p>
)}
```

Show address fields when `nearMe.ready` (unchanged condition is fine once map geocode sets ready).

Pickup Enter â€” before the line1 input:

```tsx
<LocationPickerMap
  lat={pickupCoords?.lat}
  lng={pickupCoords?.lng}
  onLocationChange={(coords) => void applyReverseGeocode('pickup', coords)}
/>
{geocodingPickup && <p className="text-xs text-muted">Updating address from mapâ€¦</p>}
```

Drop-off Enter â€” same with `dropoffCoords` / `applyReverseGeocode('dropoff', â€¦)`.

Do **not** add maps under Saved or Boss ID.

- [ ] **Step 3: Typecheck**

```bash
cd frontend && npx tsc --noEmit -p tsconfig.app.json
```

Expected: PASS.

- [ ] **Step 4: Manual browser check**

1. Open `/dashboard/local-delivery`
2. Pickup â†’ Near me â†’ allow location â†’ map shows pin; fields fill
3. Drag pin â†’ fields update via reverse geocode
4. Pickup â†’ Enter â†’ map visible; click/drag fills fields; can still edit text
5. Drop-off â†’ Enter â†’ same
6. Drop-off â†’ Boss ID â†’ no map
7. Submit a job with map-derived pickup still works

- [ ] **Step 5: Skip commit** unless the user asks

---


