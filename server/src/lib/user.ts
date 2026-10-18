import type { UserRow } from '../db/schema/index.js'

export function userFullName(user: Pick<UserRow, 'firstName' | 'lastName'>): string {
  return `${user.firstName} ${user.lastName}`
}
