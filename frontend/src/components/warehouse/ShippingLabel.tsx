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
      width: 1.2,
      height: 40,
      displayValue: false,
      margin: 2,
    })
  }, [pkg.tracking_number, preview])

  return (
    <div
      className={`shipping-label mx-auto w-full max-w-md border-2 border-black bg-white px-4 pb-4 pt-2 text-black print:max-w-none print:border print:p-0 ${className}`}
    >
      {preview && (
        <p className="no-print mb-3 rounded border border-amber-400 bg-amber-50 px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-amber-800">
          Label preview — confirm receival to assign tracking
        </p>
      )}
      <div className="border-b border-black pb-0.5 text-center print:pb-0 print:leading-tight">
        <div className="mx-auto h-[8.75rem] max-w-full overflow-hidden leading-none print:h-auto print:overflow-visible">
          <img
            src="/logo-bw.svg"
            alt="Package Boss"
            className="mx-auto block h-48 w-auto max-w-full -translate-y-6 object-contain object-top print:h-[0.48in] print:max-w-[1.82in] print:translate-y-0"
          />
        </div>
        <p className="-mt-1 text-[10px] uppercase tracking-widest text-gray-600 print:mt-0 print:text-[5px] print:leading-none print:tracking-wide print:text-black">
          Fort Lauderdale → Kingston
        </p>
      </div>

      <div className="my-2 flex shrink-0 justify-center print:my-0">
        {preview ? (
          <div className="flex h-24 w-full max-w-xs items-center justify-center border border-dashed border-gray-400 bg-gray-50 px-2 text-center text-[10px] uppercase tracking-wider text-gray-500">
            Barcode on confirm
          </div>
        ) : (
          <svg
            ref={barcodeRef}
            className="h-auto w-full max-w-[3.4in] min-h-[88px] print:min-h-0 print:max-h-[0.34in] print:max-w-[1.82in]"
          />
        )}
      </div>

      <p className="shrink-0 text-center font-mono text-base font-bold print:text-[7px] print:leading-none">
        {preview ? 'Tracking assigned on confirm' : pkg.tracking_number}
      </p>

      <div className="mt-2 space-y-1 border-t border-black py-2 text-center text-xs print:mt-0.5 print:space-y-0 print:py-0.5 print:text-[6px]">
        <p className="text-[10px] font-bold uppercase tracking-wider print:text-[5px] print:leading-none">Ship To</p>
        {customer ? (
          <>
            <p className="text-2xl font-black leading-none tracking-tight print:text-[11px] print:leading-none">
              {customer.full_name}
            </p>
            <p className="font-mono text-base font-bold print:text-[8px] print:leading-none">{customer.shipping_id}</p>
            <p className="text-sm leading-tight print:text-[7px] print:leading-none">{customer.parish}, Jamaica</p>
          </>
        ) : (
          <>
            <p className="text-2xl font-black leading-none text-red-700 print:text-[11px] print:leading-none">
              UNIDENTIFIED
            </p>
            {pkg.label_name && (
              <p className="text-xl font-bold leading-tight print:text-[8px] print:leading-none">Name on label: {pkg.label_name}</p>
            )}
            {pkg.label_boss_id && (
              <p className="font-mono text-sm font-semibold print:text-[7px] print:leading-none">
                BOSS ID on label: {pkg.label_boss_id}
              </p>
            )}
            {!pkg.label_name && !pkg.label_boss_id && (
              <p className="text-gray-600 print:text-[7px]">Owner not identified</p>
            )}
          </>
        )}
      </div>

      <div className="mt-2 grid shrink-0 grid-cols-2 gap-1.5 border-t border-black pt-2 text-xs print:mt-0.5 print:gap-0.5 print:pt-0.5 print:text-[6px]">
        <div>
          <p className="text-[10px] uppercase text-gray-600 print:text-[5px] print:leading-none">Weight</p>
          <p className="font-semibold print:text-[6px] print:leading-none">{pkg.billable_weight_lbs} lbs</p>
        </div>
        {pkg.shipper_label && (
          <div>
            <p className="text-[10px] uppercase text-gray-600 print:text-[5px] print:leading-none">Shipper</p>
            <p className="truncate font-semibold print:text-[6px] print:leading-none">{pkg.shipper_label}</p>
          </div>
        )}
        {pkg.carrier_tracking && (
          <div className={pkg.receive_batch ? undefined : 'col-span-2'}>
            <p className="text-[10px] uppercase text-gray-600 print:text-[5px] print:leading-none">Carrier Tracking</p>
            <p className="break-all font-mono text-[10px] leading-tight print:text-[5px] print:leading-none">
              {pkg.carrier_tracking}
            </p>
          </div>
        )}
        {pkg.receive_batch && (
          <div className={pkg.carrier_tracking ? undefined : 'col-start-2'}>
            <p className="text-[10px] uppercase text-gray-600 print:text-[5px] print:leading-none">Receive Batch</p>
            <p className="font-mono text-[11px] font-bold leading-tight print:text-[6px] print:leading-none">
              {pkg.receive_batch.batch_code}
            </p>
            {pkg.receive_batch.reference !== pkg.receive_batch.batch_code && (
              <p className="truncate text-[10px] text-gray-700 print:hidden">
                {pkg.receive_batch.reference}
              </p>
            )}
          </div>
        )}
      </div>

      <p className="mt-1 shrink-0 text-center text-[9px] uppercase tracking-wider text-gray-500 print:mt-0.5 print:pt-0 print:text-[5px] print:leading-none print:tracking-wide">
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
