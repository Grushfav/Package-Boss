# Task 1 review package (uncommitted — no commits per user rule)

## Files changed (task 1 scope)
 M frontend/package-lock.json
 M frontend/package.json
?? frontend/src/lib/mapStyle.ts
?? frontend/src/types/protomaps-themes-base.d.ts

## Diff

diff --git a/frontend/package.json b/frontend/package.json
index b15d196..0423623 100644
--- a/frontend/package.json
+++ b/frontend/package.json
@@ -19,6 +19,8 @@
     "axios": "^1.17.0",
     "jsbarcode": "^3.12.3",
     "lucide-react": "^1.17.0",
+    "maplibre-gl": "^6.18.0",
+    "protomaps-themes-base": "^4.5.0",
     "react": "^19.2.6",
     "react-dom": "^19.2.6",
     "react-helmet-async": "^3.0.0",

## NEW FILE frontend/src/lib/mapStyle.ts
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

## NEW FILE frontend/src/types/protomaps-themes-base.d.ts
```ts
declare module 'protomaps-themes-base' {
  export function layers(
    source: string,
    theme: string,
    lang: string,
  ): import('maplibre-gl').LayerSpecification[]
}
```

## package.json map deps

    "maplibre-gl": "^6.18.0",
    "protomaps-themes-base": "^4.5.0",
