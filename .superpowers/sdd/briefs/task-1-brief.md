### Task 1: Dependencies + map style helper

**Files:**
- Modify: `frontend/package.json` (via npm install)
- Create: `frontend/src/lib/mapStyle.ts`
- Optional: `frontend/.env.local` with `VITE_MAPS_API_KEY=...`

**Interfaces:**
- Produces: `getDevLabsMapStyle(theme?: 'light' | 'dark'): StyleSpecification`
- Produces: `JAMAICA_MAX_BOUNDS: [[west, south], [east, north]]`
- Produces: `DEFAULT_JAMAICA_CENTER: [lng, lat]` (Kingston ~ `[-76.7936, 18.0179]`)
- Produces: `DEFAULT_MAP_ZOOM = 12`

- [ ] **Step 1: Install packages**

Run from `frontend/`:

```bash
npm install maplibre-gl protomaps-themes-base
```

Expected: both appear under `dependencies` in `package.json`.

- [ ] **Step 2: Create style helper**

Create `frontend/src/lib/mapStyle.ts`:

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
          '<a href="https://maps.devlabsja.com">DevLabsJa Maps</a> Â© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    },
    layers: layers('protomaps', theme, 'en'),
  }
}

export const DEVLABS_MAP_STYLE = getDevLabsMapStyle('light')
```

- [ ] **Step 3: Verify TypeScript accepts the module**

Run from `frontend/`:

```bash
npx tsc --noEmit -p tsconfig.app.json
```

Expected: no errors in `mapStyle.ts`. If `protomaps-themes-base` types fail, add a minimal `frontend/src/types/protomaps-themes-base.d.ts`:

```ts
declare module 'protomaps-themes-base' {
  export function layers(
    source: string,
    theme: string,
    lang: string,
  ): import('maplibre-gl').LayerSpecification[]
}
```

- [ ] **Step 4: Skip commit** unless the user asks

---


