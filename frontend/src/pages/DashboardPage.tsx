import { Bell, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api, getErrorMessage } from "../api/client";
import { fetchMyPackages } from "../api/packages";
import { cancelPreAlert, fetchMyPreAlerts } from "../api/preAlerts";
import { useAuth } from "../context/AuthContext";
import { getHomeRoute } from "../lib/routing";
import {
  cacheShippingAddress,
  getCachedShippingAddress,
} from "../lib/offlineAddress";
import { Button } from "../components/ui/Button";
import type { Package as Pkg, PreAlert, ShippingAddress } from "../types";

export function DashboardPage() {
  const { user } = useAuth();
  const isCustomer = !user?.role || user.role === "customer";

  if (!isCustomer) {
    return <Navigate to={getHomeRoute(user?.role)} replace />;
  }

  return <CustomerDashboard />;
}

function CustomerDashboard() {
  const { user } = useAuth();
  const [address, setAddress] = useState<ShippingAddress | null>(null);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [preAlerts, setPreAlerts] = useState<PreAlert[]>([]);
  const [preAlertError, setPreAlertError] = useState("");
  const [copied, setCopied] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [usingCache, setUsingCache] = useState(false);

  useEffect(() => {
    function handleOnline() {
      setOffline(false);
    }
    function handleOffline() {
      setOffline(true);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (offline) {
      const cached = getCachedShippingAddress();
      if (cached) {
        setAddress(cached);
        setUsingCache(true);
      }
      return;
    }

    api
      .get<{ shipping_address: ShippingAddress }>("/me/shipping-address")
      .then(({ data }) => {
        setAddress(data.shipping_address);
        cacheShippingAddress(data.shipping_address);
        setUsingCache(false);
      })
      .catch(() => {
        const cached = getCachedShippingAddress();
        if (cached) {
          setAddress(cached);
          setUsingCache(true);
        }
      });

    fetchMyPackages()
      .then(setPackages)
      .catch(() => setPackages([]));

    fetchMyPreAlerts()
      .then(setPreAlerts)
      .catch(() => setPreAlerts([]));
  }, [offline]);

  async function handleCancelPreAlert(id: string) {
    setPreAlertError("");
    try {
      await cancelPreAlert(id);
      setPreAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setPreAlertError(getErrorMessage(err));
    }
  }

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address.formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-black uppercase">
        Welcome, <span className="text-boss-green">{user?.first_name}</span>
      </h1>
      <p className="mt-2 text-muted">
        Your BOSS shipping ID:{" "}
        <strong className="text-foreground">{user?.shipping_id}</strong>
      </p>

      <div className="mt-8 rounded-2xl border border-boss-green/30 bg-card p-8 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold uppercase tracking-wide text-black">
            Your Shipping Address
          </h2>
          {usingCache && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              <WifiOff className="h-3.5 w-3.5" />
              Offline copy
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-muted">
          Use this address when shopping online. Always put your BOSS ID on
          address line 2.
        </p>

        {address ? (
          <div className="mt-6 rounded-lg border-[3px] border-dashed border-boss-green/55 bg-background p-6">
            <pre className="whitespace-pre-wrap font-mono text-lg leading-relaxed text-black dark:text-white">
              {address.formatted}
            </pre>
          </div>
        ) : (
          <p className="mt-6 text-muted">
            {offline
              ? "No cached address available. Connect to load your Miami address."
              : "Loading address..."}
          </p>
        )}

        <Button onClick={copyAddress} className="mt-6" disabled={!address}>
          {copied ? "Copied!" : "Copy Address"}
        </Button>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-xs uppercase tracking-wider text-muted">Parish</p>
          <p className="mt-1 font-semibold">{user?.parish}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-xs uppercase tracking-wider text-muted">
            TRN on file
          </p>
          <p className="mt-1 font-semibold">
            {user?.trn_masked || "***-***-***"}
          </p>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold uppercase tracking-wide">
            Pre-Alerts
          </h2>
          <Link
            to="/pre-alerts/new"
            className="inline-flex items-center gap-2 rounded-lg border border-boss-green/30 bg-boss-green/10 px-4 py-2 text-sm font-semibold text-boss-green hover:bg-boss-green/20"
          >
            <Bell className="h-4 w-4" />
            Pre-alert a package
          </Link>
        </div>
        <p className="mt-2 text-sm text-muted">
          Submit tracking and invoice before your package reaches Miami.
        </p>

        {preAlertError && (
          <p className="mt-3 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {preAlertError}
          </p>
        )}

        {preAlerts.filter((a) => a.status !== "cancelled").length === 0 ? (
          <p className="mt-4 rounded-xl border border-border bg-card p-6 text-sm text-muted">
            No pre-alerts yet. Add one when you order online using your Miami
            address.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {preAlerts
              .filter((a) => a.status !== "cancelled")
              .map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-xl border border-border bg-card p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-mono text-sm font-bold">
                      {alert.carrier_tracking}
                    </p>
                    <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold uppercase text-amber-600 dark:text-amber-400">
                      {alert.status_label}
                    </span>
                  </div>
                  {alert.merchant && (
                    <p className="mt-2 text-sm text-muted">{alert.merchant}</p>
                  )}
                  {alert.description && (
                    <p className="mt-1 text-sm text-muted">
                      {alert.description}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-3">
                    {alert.invoice_url && (
                      <a
                        href={alert.invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-boss-green hover:underline"
                      >
                        View invoice
                      </a>
                    )}
                    {alert.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => handleCancelPreAlert(alert.id)}
                        className="text-sm text-muted hover:text-red-400"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold uppercase tracking-wide">
            My Packages
          </h2>
          <Link to="/track" className="text-sm text-boss-green hover:underline">
            Track by number →
          </Link>
        </div>

        {packages.length === 0 ? (
          <p className="mt-4 rounded-xl border border-border bg-card p-6 text-sm text-muted">
            No packages yet. Once your shipment is received at the Miami
            warehouse, it will appear here.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {packages.map((pkg) => (
              <Link
                key={pkg.id}
                to={`/track?tracking=${pkg.tracking_number}`}
                className="block rounded-xl border border-border bg-card p-5 transition-colors hover:border-boss-green/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-mono font-bold text-boss-green">
                    {pkg.tracking_number}
                  </p>
                  <span className="rounded-full bg-boss-green/15 px-3 py-1 text-xs font-semibold uppercase text-boss-green">
                    {pkg.status_label}
                  </span>
                </div>
                {pkg.shipping_cost_usd != null && (
                  <p className="mt-2 text-sm text-muted">
                    {pkg.billable_weight_lbs} lbs · $
                    {pkg.shipping_cost_usd.toFixed(2)} USD
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

    
    </div>
  );
}
