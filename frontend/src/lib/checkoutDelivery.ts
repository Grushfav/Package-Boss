import { DELIVERY_FEE_JMD } from '../api/deliveryRequests'
import type { DeliveryRequest } from '../types'

export interface CheckoutDeliveryState {
  matchedRequest: DeliveryRequest | null
  /** Fee included when checkout fully matches an open delivery request. */
  requiredDeliveryFee: number
  isCompleteMatch: boolean
  isPartialMatch: boolean
  hasMultipleRequests: boolean
  /** Selected packages not in the matched delivery request. */
  hasExtraPackages: boolean
  /** Package IDs in the matched request that are not selected. */
  missingPackageIds: string[]
}

export function resolveCheckoutDelivery(
  packageIds: string[],
  pendingRequests: DeliveryRequest[] = [],
): CheckoutDeliveryState {
  const selected = new Set(packageIds)
  if (selected.size === 0 || pendingRequests.length === 0) {
    return {
      matchedRequest: null,
      requiredDeliveryFee: 0,
      isCompleteMatch: false,
      isPartialMatch: false,
      hasMultipleRequests: false,
      hasExtraPackages: false,
      missingPackageIds: [],
    }
  }

  const matchedRequests = pendingRequests.filter((request) =>
    (request.packages ?? []).some((pkg) => selected.has(pkg.package_id)),
  )

  if (matchedRequests.length === 0) {
    return {
      matchedRequest: null,
      requiredDeliveryFee: 0,
      isCompleteMatch: false,
      isPartialMatch: false,
      hasMultipleRequests: false,
      hasExtraPackages: false,
      missingPackageIds: [],
    }
  }

  if (matchedRequests.length > 1) {
    return {
      matchedRequest: null,
      requiredDeliveryFee: 0,
      isCompleteMatch: false,
      isPartialMatch: true,
      hasMultipleRequests: true,
      hasExtraPackages: false,
      missingPackageIds: [],
    }
  }

  const request = matchedRequests[0]
  const requestPackageIds = (request.packages ?? []).map((pkg) => pkg.package_id)
  const allSelected = requestPackageIds.every((id) => selected.has(id))
  const anySelected = requestPackageIds.some((id) => selected.has(id))
  const hasExtraPackages = allSelected && selected.size > requestPackageIds.length
  const sameSelection =
    allSelected && selected.size === requestPackageIds.length && anySelected

  const missingPackageIds = requestPackageIds.filter((id) => !selected.has(id))

  return {
    matchedRequest: request,
    requiredDeliveryFee: sameSelection ? request.delivery_fee_jmd : 0,
    isCompleteMatch: sameSelection,
    isPartialMatch: (anySelected && !sameSelection) || hasExtraPackages,
    hasMultipleRequests: false,
    hasExtraPackages,
    missingPackageIds,
  }
}

export function optionalDeliveryFeeAmount(
  delivery: CheckoutDeliveryState,
  includeOptional: boolean,
): number {
  if (delivery.requiredDeliveryFee > 0) {
    return delivery.requiredDeliveryFee
  }
  return includeOptional ? DELIVERY_FEE_JMD : 0
}
