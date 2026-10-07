/** JMD handling fee applied when a customer collects 2+ packages in one checkout. */
export const MULTI_PACKAGE_HANDLING_FEE_JMD = 300

export function checkoutHandlingFeeAmount(
  packageCount: number,
  waived: boolean,
  manualFeeJmd?: number,
): number {
  if (packageCount > 1) {
    return waived ? 0 : MULTI_PACKAGE_HANDLING_FEE_JMD
  }
  return manualFeeJmd != null && manualFeeJmd > 0 ? manualFeeJmd : 0
}

/** Explicit value for the checkout API (multi-package always sends 0 or 300). */
export function checkoutHandlingFeePayload(
  packageCount: number,
  waived: boolean,
  manualFeeJmd?: number,
): number | undefined {
  if (packageCount > 1) {
    return waived ? 0 : MULTI_PACKAGE_HANDLING_FEE_JMD
  }
  return manualFeeJmd
}
