import { api } from './client'
import type { Package } from '../types'

export async function trackPackage(trackingNumber: string): Promise<Package> {
  const { data } = await api.get<{ package: Package }>(
    `/track/${encodeURIComponent(trackingNumber.trim().toUpperCase())}`,
  )
  return data.package
}
