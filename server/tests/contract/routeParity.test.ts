/**
 * Guardrail: frontend API paths must have Express handlers.
 * Run via `npm test` whenever frontend/src/api or server/src/routes change.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = resolve(import.meta.dirname, '../../..')
const FRONTEND_API_DIR = join(REPO_ROOT, 'frontend/src/api')
const SERVER_ROUTES_DIR = join(REPO_ROOT, 'server/src/routes')

/** Intentionally deferred — keep empty once a feature is mounted on Express. */
const DEFERRED_PATH_PREFIXES: string[] = []

function collectFrontendPaths(): string[] {
  const paths = new Set<string>()
  const apiFiles = readdirSync(FRONTEND_API_DIR).filter((f) => f.endsWith('.ts') && f !== 'client.ts')

  for (const file of apiFiles) {
    const content = readFileSync(join(FRONTEND_API_DIR, file), 'utf8')
    const re =
      /api\.(?:get|post|patch|put|delete)(?:<[^>]*>)?\(\s*(['`])(\/(?:\\.|(?!\1)[\s\S])*?)\1/g
    let m: RegExpExecArray | null
    while ((m = re.exec(content)) !== null) {
      let path = m[2]
      // Normalize template paths: /foo/${encodeURIComponent(id)}/bar -> /foo/:param/bar
      path = path.replace(/\$\{[^}]+\}/g, ':param')
      paths.add(path)
    }
  }
  return [...paths].sort()
}

function collectServerRoutePatterns(): string[] {
  const patterns: string[] = []
  const routeFiles = readdirSync(SERVER_ROUTES_DIR).filter((f) => f.endsWith('.ts') && f !== 'index.ts')

  for (const file of routeFiles) {
    const content = readFileSync(join(SERVER_ROUTES_DIR, file), 'utf8')
    const re =
      /(?:Router|staffRouter|adminRouter|authRouter|uploadsRouter|packagesRouter|meRouter|preAlertsRouter|deliveryRequestsRouter|logisticsJobsRouter|bankTransferProofsRouter|announcementsRouter|healthRouter|parishesRouter|ratesRouter)\.(?:get|post|patch|put|delete|all)\(\s*['`]([^'`]+)['`]/g
    let m: RegExpExecArray | null
    while ((m = re.exec(content)) !== null) {
      patterns.push(m[1])
    }
  }
  return patterns
}

function pathMatchesPattern(apiPath: string, routePattern: string): boolean {
  const normApi = apiPath.replace(/:[\w]+/g, ':param')
  const normRoute = routePattern.replace(/:[\w]+/g, ':param').replace(/\*$/, ':param')

  if (normRoute === normApi) return true
  if (normRoute.endsWith('/*') && normApi.startsWith(normRoute.slice(0, -2))) return true

  const apiParts = normApi.split('/').filter(Boolean)
  const routeParts = normRoute.split('/').filter(Boolean)
  if (apiParts.length !== routeParts.length) return false
  return routeParts.every((part, i) => part === ':param' || part === apiParts[i])
}

function isDeferred(path: string): boolean {
  return DEFERRED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))
}

describe('Frontend ↔ Express route parity', () => {
  const frontendPaths = collectFrontendPaths()
  const serverPatterns = collectServerRoutePatterns()

  it('has no deferred path prefixes while logistics is enabled', () => {
    expect(DEFERRED_PATH_PREFIXES).toEqual([])
  })

  it('every non-deferred frontend API path has an Express route', () => {
    const missing: string[] = []

    for (const path of frontendPaths) {
      if (isDeferred(path)) continue
      const found = serverPatterns.some((pattern) => pathMatchesPattern(path, pattern))
      if (!found) missing.push(path)
    }

    expect(missing, `Missing Express routes:\n${missing.join('\n')}`).toEqual([])
  })
})
