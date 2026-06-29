import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardPackageStatsCard } from '../../components/account/DashboardPackageStatsCard'
import { FortLauderdaleShippingAddressCard } from '../../components/account/FortLauderdaleShippingAddressCard'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../../components/ui/Button'
import { SHIPPING_FREQUENCY_SHORT } from '../../content/marketing'

export function DashboardHomePage() {
  const { user } = useAuth()
  const [copiedId, setCopiedId] = useState(false)

  async function copyBossId() {
    if (!user?.shipping_id) return
    await navigator.clipboard.writeText(user.shipping_id)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold uppercase tracking-wide">Dashboard</h2>
        <p className="mt-2 text-sm text-muted">
          Welcome back, {user?.first_name}. Packages ship from Fort Lauderdale to Jamaica{' '}
          <span className="font-semibold text-boss-green">{SHIPPING_FREQUENCY_SHORT}</span>.
        </p>
      </div>
      
      <div className="rounded-2xl border border-boss-green/30 bg-card p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">Your BOSS ID</p>
        <p className="mt-2 font-mono text-3xl font-black text-boss-green">{user?.shipping_id}</p>
        <p className="mt-2 text-sm text-muted">
          Put this on address line 2 whenever you shop online in the US.
        </p>
        <Button onClick={copyBossId} variant="outline" className="mt-4 !text-xs">
          {copiedId ? 'Copied!' : 'Copy BOSS ID'}
        </Button>
      </div>
      <FortLauderdaleShippingAddressCard />

      
      
      <DashboardPackageStatsCard />


      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/dashboard/track"
          className="rounded-xl border border-border bg-card p-4 text-sm font-semibold transition-colors hover:border-boss-green/40"
        >
          Track a package →
        </Link>
        <Link
          to="/pre-alerts/new"
          className="rounded-xl border border-border bg-card p-4 text-sm font-semibold transition-colors hover:border-boss-green/40"
        >
          Pre-alert a shipment →
        </Link>
        <Link
          to="/dashboard/packages"
          className="rounded-xl border border-border bg-card p-4 text-sm font-semibold transition-colors hover:border-boss-green/40"
        >
          View packages →
        </Link>
        <Link
          to="/dashboard/delivery-address"
          className="rounded-xl border border-border bg-card p-4 text-sm font-semibold transition-colors hover:border-boss-green/40"
        >
          Manage delivery addresses →
        </Link>
      </div>
    </div>
  )
}
