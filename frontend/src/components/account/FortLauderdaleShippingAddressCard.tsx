import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { useOptionalCustomerData } from '../../context/CustomerDataContext'
import { getCachedShippingAddress } from '../../lib/offlineAddress'
import { Button } from '../ui/Button'

export function FortLauderdaleShippingAddressCard() {
  const customerData = useOptionalCustomerData()
  const [copied, setCopied] = useState(false)
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    function handleOnline() {
      setOffline(false)
    }
    function handleOffline() {
      setOffline(true)
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const address = offline
    ? (customerData?.shippingAddress ?? getCachedShippingAddress())
    : customerData?.shippingAddress ?? null
  const usingCache = offline && !!address

  async function copyAddress() {
    if (!address?.formatted) return
    await navigator.clipboard.writeText(address.formatted)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-2xl border border-boss-gold/30 bg-card p-6 shadow-md shadow-boss-gold/20 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-bold uppercase tracking-wide text-foreground">
          Fort Lauderdale Shipping Address
        </h2>
        {usingCache && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
            <WifiOff className="h-3.5 w-3.5" />
            Offline copy
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-muted">
        Use this address when shopping online. Always put your BOSS ID on address line 2.
      </p>

      {address ? (
        <>
          <div className="mt-6 rounded-lg border-[3px] border-dashed border-boss-gold/55 bg-background p-6 shadow-sm shadow-boss-gold/30">
            <address className="not-italic font-mono text-base leading-relaxed sm:text-lg">
              <p className="font-bold text-foreground">{address.line1}</p>
              {address.line2 && (
                <p className="mt-1 text-xl font-black tracking-wide text-boss-gold sm:text-2xl">
                  {address.line2}
                </p>
              )}
              <p className="mt-1 font-bold text-foreground">
                {address.city}, {address.state} {address.zip}
              </p>
              <p className="mt-1 font-bold text-foreground">{address.country}</p>
            </address>
          </div>
          {address.line2 && (
            <p className="mt-4 text-sm text-muted">
              Your BOSS ID is{' '}
              <span className="font-mono font-bold text-boss-gold">{address.line2}</span> — put this
              on address line 2 when you check out.
            </p>
          )}
        </>
      ) : (
        <p className="mt-6 text-muted">
          {offline
            ? 'No cached address available. Connect to load your Fort Lauderdale address.'
            : 'Loading address...'}
        </p>
      )}

      <Button onClick={copyAddress} className="mt-6" disabled={!address}>
        {copied ? 'Copied!' : 'Copy Address'}
      </Button>
    </div>
  )
}
