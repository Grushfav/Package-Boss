import JsBarcode from 'jsbarcode'
import { useEffect, useRef } from 'react'
import type { Package, StaffCustomer } from '../../types'

interface ShippingLabelProps {
  pkg: Package
  customer?: StaffCustomer | null
  className?: string
}

export function ShippingLabel({ pkg, customer, className = '' }: ShippingLabelProps) {
  const barcodeRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (barcodeRef.current && pkg.tracking_number) {
      JsBarcode(barcodeRef.current, pkg.tracking_number, {
        format: 'CODE128',
        width: 2,
        height: 56,
        displayValue: true,
        fontSize: 14,
        margin: 8,
      })
    }
  }, [pkg.tracking_number])

  return (
    <div
      className={`shipping-label mx-auto w-full max-w-md border-2 border-black bg-white p-6 text-black ${className}`}
    >
      <div className="border-b-2 border-black pb-3 text-center">
        <img
          src="/logo-bw.svg"
          alt="Package Boss"
          className="mx-auto h-[1.35in] max-w-full w-auto object-contain print:h-[1.35in] print:max-w-full"
        />
        <p className="mt-1 text-xs uppercase tracking-widest text-gray-600">Miami → Kingston</p>
      </div>

      <div className="my-4 flex justify-center">
        <svg ref={barcodeRef} />
      </div>

      <p className="text-center font-mono text-xl font-bold">{pkg.tracking_number}</p>

      <div className="mt-4 space-y-1 border-t border-black pt-4 text-sm">
        <p className="text-xs font-bold uppercase tracking-wider">Ship To</p>
        {customer ? (
          <>
            <p className="text-lg font-bold">{customer.full_name}</p>
            <p className="font-mono font-semibold">{customer.shipping_id}</p>
            <p>{customer.parish}, Jamaica</p>
          </>
        ) : (
          <>
            <p className="text-lg font-bold text-red-700">UNIDENTIFIED</p>
            {pkg.label_name && <p>Name on label: {pkg.label_name}</p>}
            {pkg.label_boss_id && (
              <p className="font-mono font-semibold">BOSS ID on label: {pkg.label_boss_id}</p>
            )}
            {!pkg.label_name && !pkg.label_boss_id && (
              <p className="text-gray-600">Owner not identified</p>
            )}
          </>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-black pt-4 text-sm">
        <div>
          <p className="text-xs uppercase text-gray-600">Weight</p>
          <p className="font-semibold">{pkg.billable_weight_lbs} lbs</p>
        </div>
        {pkg.shipper_label && (
          <div>
            <p className="text-xs uppercase text-gray-600">Shipper</p>
            <p className="font-semibold">{pkg.shipper_label}</p>
          </div>
        )}
        {pkg.carrier_tracking && (
          <div className="col-span-2">
            <p className="text-xs uppercase text-gray-600">Carrier Tracking</p>
            <p className="break-all font-mono text-xs">{pkg.carrier_tracking}</p>
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-[10px] uppercase tracking-wider text-gray-500">
        Received Miami · {new Date(pkg.received_at || pkg.created_at).toLocaleDateString()}
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
