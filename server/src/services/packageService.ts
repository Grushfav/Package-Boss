import { asc, eq } from 'drizzle-orm'
import { packageEvents, packagePhotos, packages, type UserRow } from '../db/schema/index.js'
import { db } from '../db/index.js'
import { packageEventToDict } from '../lib/serializers/package.js'

export { addPackageEvent, updatePackageStatus } from './warehousePackageService.js'

type PackageRow = typeof packages.$inferSelect
type PackageEventRow = typeof packageEvents.$inferSelect
export async function getPackagePhotos(packageId: string) {
  return db
    .select()
    .from(packagePhotos)
    .where(eq(packagePhotos.packageId, packageId))
    .orderBy(asc(packagePhotos.createdAt))
}

export async function getPackageEvents(packageId: string): Promise<PackageEventRow[]> {
  return db
    .select()
    .from(packageEvents)
    .where(eq(packageEvents.packageId, packageId))
    .orderBy(asc(packageEvents.createdAt))
}

export async function getTrackingTimeline(pkg: PackageRow): Promise<Array<Record<string, unknown>>> {
  const events = await getPackageEvents(pkg.id)
  if (!events.length) return []
  const lastId = events[events.length - 1]!.id
  return events.map((event) => ({
    ...packageEventToDict(event),
    is_current: event.status === pkg.status && event.id === lastId,
  }))
}

export async function getCustomerPackage(
  user: UserRow,
  packageId: string,
): Promise<PackageRow | null> {
  const [row] = await db
    .select()
    .from(packages)
    .where(eq(packages.id, packageId))
    .limit(1)
  if (!row || row.customerId !== user.id) return null
  return row
}
