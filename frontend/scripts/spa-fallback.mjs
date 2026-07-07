import { cpSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const indexPath = join(dist, 'index.html')

if (!existsSync(indexPath)) {
  console.error('spa-fallback: dist/index.html not found — run vite build first')
  process.exit(1)
}

/**
 * Client routes that may be opened directly (bookmarks, shared links, sitemap).
 * Each becomes dist/<route>/index.html so static hosts serve real HTML with a
 * text/html content type. Extensionless files must NOT be used: Render serves
 * them as binary/octet-stream, which makes browsers download the page.
 */
const routes = [
  'about',
  'services',
  'rates',
  'login',
  'signup',
  'terms',
  'privacy',
  'data-protection',
  'forgot-password',
  'reset-password',
  'track',
  'dashboard',
  'dashboard/profile',
  'dashboard/pre-alerts',
  'dashboard/packages',
  'dashboard/rates',
  'dashboard/notifications',
  'pre-alerts/new',
  'warehouse',
  'warehouse/customers',
  'warehouse/receive',
  'warehouse/unidentified',
  'warehouse/pre-alerts',
  'warehouse/print-queue',
  'warehouse/status',
  'warehouse/activity',
  'admin',
  'admin/operations',
  'admin/clerks',
  'staff/receive',
]

for (const route of routes) {
  const dir = join(dist, route)

  // Clear leftover extensionless files from prior builds at any path segment.
  const segments = route.split('/')
  for (let i = 1; i <= segments.length; i += 1) {
    const partial = join(dist, ...segments.slice(0, i))
    if (existsSync(partial) && statSync(partial).isFile()) {
      rmSync(partial, { force: true })
    }
  }

  mkdirSync(dir, { recursive: true })
  cpSync(indexPath, join(dir, 'index.html'))
}

console.log(`spa-fallback: wrote ${routes.length} route index.html files`)
