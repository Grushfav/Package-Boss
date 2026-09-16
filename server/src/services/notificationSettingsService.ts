import { eq } from 'drizzle-orm'
import { CUSTOMER_EMAIL_NOTIFICATIONS_KEY } from '../constants.js'
import { db } from '../db/index.js'
import { appSettings, type UserRow } from '../db/schema/index.js'
import { utcIsoformat } from '../lib/dates.js'

function parseBool(value: string | null | undefined, defaultValue: boolean): boolean {
  if (value == null) return defaultValue
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return defaultValue
}

export async function customerEmailNotificationsEnabled(): Promise<boolean> {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, CUSTOMER_EMAIL_NOTIFICATIONS_KEY))
    .limit(1)

  if (!row) return true
  return parseBool(row.value, true)
}

export async function getCustomerEmailNotificationSettings() {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, CUSTOMER_EMAIL_NOTIFICATIONS_KEY))
    .limit(1)

  const enabled = await customerEmailNotificationsEnabled()
  return {
    customer_email_notifications_enabled: enabled,
    updated_at: row?.updatedAt ? utcIsoformat(row.updatedAt) : null,
    updated_by_id: row?.updatedById ?? null,
  }
}

export async function setCustomerEmailNotificationsEnabled(enabled: boolean, updatedBy: UserRow | null) {
  const value = enabled ? 'true' : 'false'
  const now = new Date()

  const [existing] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, CUSTOMER_EMAIL_NOTIFICATIONS_KEY))
    .limit(1)

  if (!existing) {
    await db.insert(appSettings).values({
      key: CUSTOMER_EMAIL_NOTIFICATIONS_KEY,
      value,
      updatedAt: now,
      updatedById: updatedBy?.id ?? null,
    })
  } else {
    await db
      .update(appSettings)
      .set({
        value,
        updatedAt: now,
        updatedById: updatedBy?.id ?? existing.updatedById,
      })
      .where(eq(appSettings.key, CUSTOMER_EMAIL_NOTIFICATIONS_KEY))
  }

  return getCustomerEmailNotificationSettings()
}
