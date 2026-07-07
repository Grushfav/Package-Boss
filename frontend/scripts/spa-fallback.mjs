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
 * Paths that may be opened directly (sitemap, bookmarks, shared links).
 * Single-segment paths become extensionless files (dist/rates).
 * Multi-segment paths become nested extensionless files (dist/dashboard/packages).
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
  'dashboard/profile',
  'dashboard/pre-alerts',
  'dashboard/packages',
  'dashboard/rates',
  'dashboard/notifications',
  'pre-alerts/new',
  'warehouse/customers',
  'warehouse/receive',
  'warehouse/unidentified',
  'warehouse/pre-alerts',
  'warehouse/print-queue',
  'warehouse/status',
  'warehouse/activity',
  'admin/operations',
  'admin/clerks',
  'staff/receive',
]

/** Parent paths that also need index.html so /dashboard/ resolves. */
const directoryIndexes = new Set(['dashboard', 'warehouse', 'admin', 'pre-alerts'])

function removePathIfExists(path) {
  if (!existsSync(path)) return
  rmSync(path, { recursive: true, force: true })
}

function writeRouteFile(route) {
  const segments = route.split('/')

  if (segments.length === 1) {
    const target = join(dist, segments[0])
    removePathIfExists(target)
    cpSync(indexPath, target)
    return
  }

  const parentDir = join(dist, ...segments.slice(0, -1))
  const target = join(parentDir, segments.at(-1))
  mkdirSync(parentDir, { recursive: true })
  if (existsSync(target)) {
    try {
      if (statSync(target).isDirectory()) {
        removePathIfExists(target)
      }
    } catch {
      removePathIfExists(target)
    }
  }
  cpSync(indexPath, target)
}

for (const route of routes) {
  writeRouteFile(route)
}

for (const dir of directoryIndexes) {
  const dirPath = join(dist, dir)
  mkdirSync(dirPath, { recursive: true })
  const indexFile = join(dirPath, 'index.html')
  if (!existsSync(indexFile)) {
    cpSync(indexPath, indexFile)
  }
}

console.log(`spa-fallback: wrote index.html shells for ${routes.length} client routes`)
