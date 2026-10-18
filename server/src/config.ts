import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'

const rootEnv = resolve(import.meta.dirname, '../../.env')
loadEnv({ path: rootEnv })
loadEnv()

const INSECURE_SECRET_VALUES = new Set(['', 'dev-secret-change-me', 'change-me-in-production'])

function env(key: string, fallback = ''): string {
  return (process.env[key] ?? fallback).trim()
}

function envBool(key: string, fallback = true): boolean {
  const raw = env(key, fallback ? 'true' : 'false').toLowerCase()
  return !['0', 'false', 'no'].includes(raw)
}

function buildCorsOrigins(): string[] {
  const frontend = env('FRONTEND_URL', 'http://localhost:5173').replace(/\/$/, '')
  const raw = env('CORS_ORIGINS', frontend)
  const origins = new Set(
    raw
      .split(',')
      .map((o) => o.trim().replace(/\/$/, ''))
      .filter(Boolean),
  )
  if (frontend) origins.add(frontend)
  return [...origins].sort()
}

export function isProductionEnv(): boolean {
  const envName = env('FLASK_ENV', env('ENV', 'development')).toLowerCase()
  return envName === 'production'
}

export const config = {
  port: parseInt(env('PORT', '5001'), 10),
  secretKey: env('SECRET_KEY', 'dev-secret-change-me'),
  databaseUrl: env('DATABASE_URL', 'sqlite:///package_boss.db'),
  jwtSecretKey: env('JWT_SECRET_KEY') || env('SECRET_KEY', 'dev-secret-change-me'),
  jwtAccessTokenExpiresSec: 60 * 60 * 24,
  bossIdSeqStart: parseInt(env('BOSS_ID_SEQ_START', '1000'), 10),
  frontendUrl: env('FRONTEND_URL', 'http://localhost:5173').replace(/\/$/, ''),
  corsOrigins: buildCorsOrigins(),
  warehouseLine1: env('WAREHOUSE_LINE1', '2201 SW 59th Terrace'),
  warehouseCity: env('WAREHOUSE_CITY', 'West Park'),
  warehouseState: env('WAREHOUSE_STATE', 'FL'),
  warehouseZip: env('WAREHOUSE_ZIP', '33023'),
  warehouseCountry: env('WAREHOUSE_COUNTRY', 'US'),
  emailProvider: env('EMAIL_PROVIDER', 'console'),
  emailApiUrl: env('EMAIL_API_URL').replace(/\/$/, ''),
  emailApiKey: env('EMAIL_API_KEY'),
  imageUploadUrl: env('IMAGE_UPLOAD_URL'),
  imageApiKey: env('IMAGE_API_KEY'),
  imageUploadWorkerUrl: env('IMAGE_UPLOAD_WORKER_URL').replace(/\/$/, ''),
  imageUploadApiKey: env('IMAGE_UPLOAD_API_KEY') || env('IMAGE_API_KEY'),
  defaultFromEmail: env('DEFAULT_FROM_EMAIL', 'info@packagebossja.com'),
  defaultFromName: env('DEFAULT_FROM_NAME', 'Package Boss'),
  emailLogoUrl: env('EMAIL_LOGO_URL'),
  whatsappProvider: env('WHATSAPP_PROVIDER', 'console'),
  whatsappAccessToken: env('WHATSAPP_ACCESS_TOKEN'),
  whatsappPhoneNumberId: env('WHATSAPP_PHONE_NUMBER_ID'),
  whatsappApiVersion: env('WHATSAPP_API_VERSION', 'v21.0'),
  storagePublicUrl: env('STORAGE_PUBLIC_URL').replace(/\/$/, ''),
  localUploadsEnabled: envBool('LOCAL_UPLOADS_ENABLED', true),
  localUploadRoot: env('LOCAL_UPLOAD_ROOT'),
  adminEmail: env('ADMIN_EMAIL').toLowerCase(),
  clerkEmail: (env('CLERK_EMAIL') || env('STAFF_EMAIL')).toLowerCase(),
  googleClientId: env('GOOGLE_CLIENT_ID'),
}

export function validateProductionConfig(): void {
  if (!isProductionEnv()) return
  const errors: string[] = []
  if (INSECURE_SECRET_VALUES.has(config.secretKey)) {
    errors.push('SECRET_KEY must be set to a secure random value in production')
  }
  if (INSECURE_SECRET_VALUES.has(config.jwtSecretKey)) {
    errors.push('JWT_SECRET_KEY must be set to a secure random value in production')
  } else if (config.jwtSecretKey === config.secretKey) {
    errors.push('JWT_SECRET_KEY must differ from SECRET_KEY in production')
  }
  if (!config.databaseUrl) {
    errors.push('DATABASE_URL must be set in production')
  } else if (config.databaseUrl.toLowerCase().startsWith('sqlite')) {
    errors.push('DATABASE_URL must not use SQLite in production')
  }
  if (errors.length) {
    throw new Error(`Production configuration invalid:\n${errors.map((e) => `  - ${e}`).join('\n')}`)
  }
}
