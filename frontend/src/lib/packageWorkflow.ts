import type { Package } from '../types'
import { packagePaymentConfirmed } from './packageBilling'
import { getStatusLabel, WORKFLOW_STATUSES } from './packageStatuses'
export type QueuePresetId =
  | 'today'
  | 'received'
  | 'in-transit'
  | 'customs'
  | 'ready'
  | 'custom'

export interface StatusAdvance {
  value: string
  label: string
  actionLabel: string
}

export const NEXT_STATUS: Partial<Record<string, StatusAdvance>> = {
  received: {
    value: 'in_transit',
    label: 'In Transit',
    actionLabel: 'Mark in transit',
  },
  in_transit: {
    value: 'customs',
    label: 'Customs',
    actionLabel: 'Mark in customs',
  },
  ready_for_pickup: {
    value: 'delivered',
    label: 'Delivered',
    actionLabel: 'Mark delivered',
  },
}

export type SelectionMode = 'none' | 'mixed' | 'customs' | 'advance' | 'terminal' | 'payment_required'

export interface SelectionAnalysis {
  count: number
  status: string | null
  statusLabel: string | null
  homogeneous: boolean
  nextAdvance: StatusAdvance | null
  mode: SelectionMode
  unpaidCount: number
  paidCount: number
}
export function analyzeSelection(
  packages: Package[],
  selectedIds: Set<string>,
): SelectionAnalysis {
  const selected = packages.filter((pkg) => selectedIds.has(pkg.id))
  const count = selected.length

  if (count === 0) {
    return {
      count: 0,
      status: null,
      statusLabel: null,
      homogeneous: false,
      nextAdvance: null,
      mode: 'none',
      unpaidCount: 0,
      paidCount: 0,
    }
  }

  const unpaidCount = selected.filter((pkg) => !packagePaymentConfirmed(pkg)).length
  const paidCount = count - unpaidCount

  const statuses = new Set(selected.map((pkg) => pkg.status))
  const homogeneous = statuses.size === 1
  const status = homogeneous ? selected[0].status : null
  const statusLabel = status ? getStatusLabel(status) : null

  if (!homogeneous) {
    return {
      count,
      status,
      statusLabel,
      homogeneous: false,
      nextAdvance: null,
      mode: 'mixed',
      unpaidCount,
      paidCount,
    }
  }

  if (status === 'customs') {
    return {
      count,
      status,
      statusLabel,
      homogeneous: true,
      nextAdvance: null,
      mode: 'customs',
      unpaidCount,
      paidCount,
    }
  }

  if (status === 'delivered') {
    return {
      count,
      status,
      statusLabel,
      homogeneous: true,
      nextAdvance: null,
      mode: 'terminal',
      unpaidCount,
      paidCount,
    }
  }

  if (status === 'ready_for_pickup' && unpaidCount > 0) {
    return {
      count,
      status,
      statusLabel,
      homogeneous: true,
      nextAdvance: NEXT_STATUS.ready_for_pickup ?? null,
      mode: 'payment_required',
      unpaidCount,
      paidCount,
    }
  }

  const nextAdvance = status ? (NEXT_STATUS[status] ?? null) : null
  return {
    count,
    status,
    statusLabel,
    homogeneous: true,
    nextAdvance,
    mode: nextAdvance ? 'advance' : 'terminal',
    unpaidCount,
    paidCount,
  }
}

export function daysInCurrentStatus(pkg: Package): number | null {
  const events = pkg.events ?? pkg.timeline ?? []
  const current =
    events.find((event) => event.is_current) ??
    [...events].reverse().find((event) => event.status === pkg.status)
  const at = current?.created_at ?? pkg.received_at
  if (!at) return null
  const ms = Date.now() - new Date(at).getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

export const STATUS_BADGE_CLASS: Record<string, string> = {
  awaiting_receipt: 'bg-muted/30 text-muted',
  received: 'bg-sky-500/15 text-sky-300',
  in_transit: 'bg-violet-500/15 text-violet-300',
  customs: 'bg-amber-500/15 text-amber-300',
  ready_for_pickup: 'bg-boss-green/15 text-boss-green',
  delivered: 'bg-muted/25 text-muted',
}

export const INVOICE_BADGE_CLASS: Record<string, string> = {
  not_required: 'text-muted',
  pending: 'text-muted',
  requested: 'text-amber-400',
  received: 'text-boss-green',
}

export { WORKFLOW_STATUSES, getStatusLabel }
