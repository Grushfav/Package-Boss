import JsBarcode from 'jsbarcode'
import { useEffect, useRef } from 'react'
import type { Package, StaffCustomer } from '../../types'

interface ShippingLabelProps {
  pkg: Package
  customer?: StaffCustomer | null
  className?: string
  preview?: boolean
}

export function ShippingLabel({ pkg, customer, className = '', preview = false }: ShippingLabelProps) {
  const barcodeRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (preview || !barcodeRef.current || !pkg.tracking_number) return
    JsBarcode(barcodeRef.current, pkg.tracking_number, {
      format: 'CODE128',
      width: 1,
      height: 22,
      displayValue: false,
      margin: 0,
    })
  }, [pkg.tracking_number, preview])

  const receivedDate = new Date(pkg.received_at || pkg.created_at).toLocaleDateString()

  return (
    <div className={`shipping-label ${className}`.trim()}>
      {preview && (
        <p className="shipping-label__preview-note no-print">
          Label preview — confirm receival to assign tracking
        </p>
      )}

      <header className="shipping-label__header">
        <div className="shipping-label__logo-wrap">
          <img src="/logo-bw.svg" alt="" className="shipping-label__logo" aria-hidden />
        </div>
        <p className="shipping-label__route">Fort Lauderdale → Kingston</p>
      </header>

      <div className="shipping-label__barcode-wrap">
        {preview ? (
          <div className="shipping-label__barcode-placeholder">Barcode on confirm</div>
        ) : (
          <svg ref={barcodeRef} className="shipping-label__barcode" />
        )}
      </div>

      <p className="shipping-label__tracking">
        {preview ? 'Tracking assigned on confirm' : pkg.tracking_number}
      </p>

      <section className="shipping-label__ship-to">
        <p className="shipping-label__section-title">Ship To</p>
        {customer ? (
          <>
            <p className="shipping-label__customer-name">{customer.full_name}</p>
            <p className="shipping-label__boss-id">{customer.shipping_id}</p>
            <p className="shipping-label__parish">{customer.parish}, Jamaica</p>
          </>
        ) : (
          <>
            <p className="shipping-label__unidentified">UNIDENTIFIED</p>
            {pkg.label_name && (
              <p className="shipping-label__label-hint">Name: {pkg.label_name}</p>
            )}
            {pkg.label_boss_id && (
              <p className="shipping-label__label-hint shipping-label__label-hint--mono">
                BOSS ID: {pkg.label_boss_id}
              </p>
            )}
            {!pkg.label_name && !pkg.label_boss_id && (
              <p className="shipping-label__label-hint">Owner not identified</p>
            )}
          </>
        )}
      </section>

      <section className="shipping-label__meta">
        <div className="shipping-label__meta-grid">
          <div className="shipping-label__meta-cell">
            <span className="shipping-label__meta-cell-label">Weight</span>
            <span className="shipping-label__meta-cell-value">{pkg.billable_weight_lbs} lbs</span>
          </div>
          {pkg.shipper_label && (
            <div className="shipping-label__meta-cell">
              <span className="shipping-label__meta-cell-label">Shipper</span>
              <span className="shipping-label__meta-cell-value shipping-label__meta-cell-value--regular">
                {pkg.shipper_label}
              </span>
            </div>
          )}
          {pkg.receive_batch && (
            <div className="shipping-label__meta-cell">
              <span className="shipping-label__meta-cell-label">Batch</span>
              <span className="shipping-label__meta-cell-value shipping-label__meta-cell-value--mono">
                {pkg.receive_batch.batch_code}
              </span>
            </div>
          )}
        </div>
        {pkg.carrier_tracking ? (
          <div className="shipping-label__meta-carrier">
            <span className="shipping-label__meta-carrier-label">Carrier tracking</span>
            <span className="shipping-label__meta-carrier-value">{pkg.carrier_tracking}</span>
          </div>
        ) : (
          <div className="shipping-label__meta-spacer" aria-hidden />
        )}
      </section>

      <footer className="shipping-label__footer">
        Received Fort Lauderdale · {receivedDate}
      </footer>
    </div>
  )
}

export function printShippingLabels() {
  window.print()
}

export function printShippingLabel() {
  window.print()
}

export function markPrintedAfterPrint(onPrinted: () => void) {
  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    window.removeEventListener('afterprint', finish)
    onPrinted()
  }
  window.addEventListener('afterprint', finish)
  window.print()
}
