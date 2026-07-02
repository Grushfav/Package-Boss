import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { api } from '../../api/client'
import { cacheShippingAddress, getCachedShippingAddress } from '../../lib/offlineAddress'
import { Button } from '../ui/Button'
import type { ShippingAddress } from '../../types'

export function FortLauderdaleShippingAddressCard() {
  const [address, setAddress] = useState<ShippingAddress | null>(null)
  const [copied, setCopied] = useState(false)
  const [offline, setOffline] = useState(!navigator.onLine)
  const [usingCache, setUsingCache] = useState(false)

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

  useEffect(() => {
    if (offline) {
      const cached = getCachedShippingAddress()
      if (cached) {
        setAddress(cached)
        setUsingCache(true)
      }
      return
    }

    api
      .get<{ shipping_address: ShippingAddress }>('/me/shipping-address')
      .then(({ data }) => {
        setAddress(data.shipping_address)
        cacheShippingAddress(data.shipping_address)
        setUsingCache(false)
      })
      .catch(() => {
        const cached = getCachedShippingAddress()
        if (cached) {
          setAddress(cached)
          setUsingCache(true)
        }
      })
  }, [offline])

  async function copyAddress() {
    if (!address) return
    await navigator.clipboard.writeText(address.formatted)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-2xl border border-boss-green/30 bg-card p-6 shadow-sm sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold uppercase tracking-wide text-black dark:text-white">
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
        <div className="mt-6 rounded-lg border-[3px] border-dashed border-boss-gold/55 bg-background p-6">
          <pre className="whitespace-pre-wrap font-mono text-base leading-relaxed text-black dark:text-white sm:text-lg">
            {address.formatted}
          </pre>
        </div>
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
