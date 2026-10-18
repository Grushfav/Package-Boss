import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { eq } from 'drizzle-orm'
import { ADMIN_ROLES, WAREHOUSE_ROLES } from '../constants.js'
import { config } from '../config.js'
import { db } from '../db/index.js'
import { users, type UserRow } from '../db/schema/index.js'
import { clerkHasAnyPermission } from '../services/clerkPermissionService.js'
import { tokenVersionMatches } from '../services/tokenService.js'

export type AuthRequest = Request & {
  user?: UserRow
  jwtClaims?: jwt.JwtPayload
}

async function loadUserFromJwt(sub: string | undefined): Promise<UserRow | null> {
  if (!sub) return null
  try {
    const [user] = await db.select().from(users).where(eq(users.id, sub)).limit(1)
    return user ?? null
  } catch {
    return null
  }
}

export async function resolveJwtUser(
  req: AuthRequest,
  res: Response,
  opts: { requireActive?: boolean } = {},
): Promise<UserRow | null> {
  const requireActive = opts.requireActive !== false
  const user = await loadUserFromJwt(req.jwtClaims?.sub)
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return null
  }
  if (!tokenVersionMatches(user, req.jwtClaims?.tv)) {
    res.status(401).json({ error: 'Token has been revoked' })
    return null
  }
  if (requireActive && !user.isActive) {
    res.status(403).json({ error: 'Account deactivated' })
    return null
  }
  req.user = user
  return user
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  return header.slice(7).trim() || null
}

function verifyToken(token: string): jwt.JwtPayload {
  return jwt.verify(token, config.jwtSecretKey) as jwt.JwtPayload
}

export function jwtRequired(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req)
  if (!token) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }
  try {
    req.jwtClaims = verifyToken(token)
    next()
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token has expired' })
      return
    }
    res.status(401).json({ error: 'Invalid token' })
  }
}

export function jwtOptional(req: AuthRequest, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req)
  if (token) {
    try {
      req.jwtClaims = verifyToken(token)
    } catch {
      // optional — ignore invalid tokens
    }
  }
  next()
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  jwtRequired(req, res, async () => {
    const user = await resolveJwtUser(req, res)
    if (!user) return
    next()
  })
}

export function requireWarehouse(req: AuthRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (!(WAREHOUSE_ROLES as readonly string[]).includes(req.user!.role)) {
      res.status(403).json({ error: 'Clerk access required' })
      return
    }
    next()
  })
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (!(ADMIN_ROLES as readonly string[]).includes(req.user!.role)) {
      res.status(403).json({ error: 'Admin access required' })
      return
    }
    next()
  })
}

export function permissionRequired(...requiredPerms: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    requireAuth(req, res, () => {
      const user = req.user!
      if (!(WAREHOUSE_ROLES as readonly string[]).includes(user.role)) {
        res.status(403).json({ error: 'Clerk access required' })
        return
      }
      if (user.role === 'admin') {
        next()
        return
      }
      if (!clerkHasAnyPermission(user, requiredPerms)) {
        res.status(403).json({ error: 'Permission denied' })
        return
      }
      next()
    })
  }
}

export function warehouseRequired() {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    requireWarehouse(req, res, next)
  }
}

export function adminRequired() {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    requireAdmin(req, res, next)
  }
}

export function getUserFromJwt(req: AuthRequest): UserRow | undefined {
  return req.user
}

export const staffRequired = requireWarehouse
