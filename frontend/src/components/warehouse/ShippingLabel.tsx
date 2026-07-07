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
      width: 1.6,
      height: 44,
      displayValue: true,
      fontSize: 11,
      margin: 4,
    })
  }, [pkg.tracking_number, preview])

  return (
    <div
      className={`shipping-label mx-auto w-full max-w-md border-2 border-black bg-white p-4 text-black print:max-w-none print:border print:p-0 ${className}`}
    >
      {preview && (
        <p className="no-print mb-3 rounded border border-amber-400 bg-amber-50 px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-amber-800">
          Label preview — confirm receival to assign tracking
        </p>
      )}
      <div className="border-b border-black pb-1.5 text-center print:pb-1">
        <img
          src="/logo-bw.svg"
          alt="Package Boss"
          className="mx-auto h-14 max-w-full w-auto object-contain print:h-[0.75in] print:max-w-[3.2in]"
        />
        <p className="mt-0.5 text-[10px] uppercase tracking-widest text-gray-600 print:text-[8px]">
          Fort Lauderdale → Kingston
        </p>
      </div>

      <div className="my-2 flex shrink-0 justify-center print:my-1">
        {preview ? (
          <div className="flex h-14 w-full max-w-xs items-center justify-center border border-dashed border-gray-400 bg-gray-50 px-2 text-center text-[10px] uppercase tracking-wider text-gray-500">
            Barcode on confirm
          </div>
        ) : (
          <svg ref={barcodeRef} className="max-h-12 w-full max-w-[3.4in] print:max-h-[0.85in]" />
        )}
      </div>

      <p className="shrink-0 text-center font-mono text-base font-bold print:text-sm">
        {preview ? 'Tracking assigned on confirm' : pkg.tracking_number}
      </p>

      <div className="mt-2 space-y-0.5 border-t border-black pt-2 text-xs print:mt-1 print:pt-1 print:text-[9px]">
        <p className="text-[10px] font-bold uppercase tracking-wider print:text-[9px]">Ship To</p>
        {customer ? (
          <>
            <p className="text-base font-bold leading-tight print:text-[15px]">{customer.full_name}</p>
            <p className="font-mono text-sm font-semibold print:text-[13px]">{customer.shipping_id}</p>
            <p className="text-sm leading-tight print:text-[12px]">{customer.parish}, Jamaica</p>
          </>
        ) : (
          <>
            <p className="text-base font-bold leading-tight text-red-700 print:text-[15px]">UNIDENTIFIED</p>
            {pkg.label_name && <p className="text-sm leading-tight print:text-[12px]">Name on label: {pkg.label_name}</p>}
            {pkg.label_boss_id && (
              <p className="font-mono text-sm font-semibold print:text-[13px]">
                BOSS ID on label: {pkg.label_boss_id}
              </p>
            )}
            {!pkg.label_name && !pkg.label_boss_id && (
              <p className="text-gray-600">Owner not identified</p>
            )}
          </>
        )}
      </div>

      <div className="mt-2 grid shrink-0 grid-cols-2 gap-1.5 border-t border-black pt-2 text-xs print:mt-2 print:gap-1.5 print:pt-2 print:text-[12px]">
        <div>
          <p className="text-[10px] uppercase text-gray-600 print:text-[9px]">Weight</p>
          <p className="font-semibold">{pkg.billable_weight_lbs} lbs</p>
        </div>
        {pkg.shipper_label && (
          <div>
            <p className="text-[10px] uppercase text-gray-600 print:text-[9px]">Shipper</p>
            <p className="truncate font-semibold">{pkg.shipper_label}</p>
          </div>
        )}
        {pkg.carrier_tracking && (
          <div className="col-span-2">
            <p className="text-[10px] uppercase text-gray-600 print:text-[9px]">Carrier Tracking</p>
            <p className="break-all font-mono text-[10px] leading-tight print:text-[11px]">
              {pkg.carrier_tracking}
            </p>
          </div>
        )}
      </div>

      <p className="mt-1 shrink-0 text-center text-[9px] uppercase tracking-wider text-gray-500 print:mt-auto print:pt-1 print:text-[8px]">
        Received Fort Lauderdale · {new Date(pkg.received_at || pkg.created_at).toLocaleDateString()}
      </p>
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
  const handler = () => {
    onPrinted()
    window.removeEventListener('afterprint', handler)
  }
  window.addEventListener('afterprint', handler)
  window.print()
}
