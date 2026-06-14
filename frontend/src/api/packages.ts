import { api } from './client'
import type { Package } from '../types'

export async function fetchMyPackages(): Promise<Package[]> {
  const { data } = await api.get<{ packages: Package[] }>('/me/packages')
  return data.packages
}

export async function fetchMyPackage(id: string): Promise<Package> {
  const { data } = await api.get<{ package: Package }>(`/me/packages/${id}`)
  return data.package
}
