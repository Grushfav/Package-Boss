import { Activity, BarChart3 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  fetchActivityLog,
  fetchAdminOverview,
  fetchPackagesByStatus,
  fetchPackagesTimeline,
  fetchPreAlertsVsReceives,
  fetchWeightDistribution,
} from '../api/admin'
import { IconBadge } from '../components/ui/IconBadge'
import type { AdminOverview, AuditLogEntry } from '../types'

const CHART_COLORS = ['#eab308', '#ca8a04', '#22c55e', '#3b82f6', '#a855f7', '#64748b']

function formatShortDate(dateStr: string) {
  return dateStr.slice(5)
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 text-3xl font-black text-boss-green">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  )
}

export function AdminOperationsPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [timeline, setTimeline] = useState<{ date: string; count: number }[]>([])
  const [statuses, setStatuses] = useState<{ label: string; count: number }[]>([])
  const [weights, setWeights] = useState<{ label: string; count: number }[]>([])
  const [compare, setCompare] = useState<{ date: string; pre_alerts: number; received: number }[]>([])
  const [recentActivity, setRecentActivity] = useState<AuditLogEntry[]>([])

  useEffect(() => {
    fetchAdminOverview().then(setOverview).catch(() => {})
    fetchPackagesTimeline(30).then(setTimeline).catch(() => {})
    fetchPackagesByStatus().then((s) => setStatuses(s.map((x) => ({ label: x.label, count: x.count })))).catch(() => {})
    fetchWeightDistribution().then(setWeights).catch(() => {})
    fetchPreAlertsVsReceives(30).then(setCompare).catch(() => {})
    fetchActivityLog(8, 0).then((d) => setRecentActivity(d.activity)).catch(() => {})
  }, [])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <IconBadge icon={BarChart3} size="sm" />
          <div>
            <h1 className="text-2xl font-black uppercase">Metrics</h1>
            <p className="text-sm text-muted">Package volume, trends, and clerk activity</p>
          </div>
        </div>
        <Link
          to="/warehouse/activity"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold hover:border-boss-gold/40"
        >
          <Activity className="h-4 w-4" />
          Activity log
        </Link>
      </div>

      {overview && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard label="Received today" value={overview.packages_today} />
          <KpiCard label="Received 7d" value={overview.packages_7d} />
          <KpiCard label="Received 30d" value={overview.packages_30d} />
          <KpiCard label="Pending pre-alerts" value={overview.pending_pre_alerts} />
          <KpiCard label="In transit" value={overview.in_transit} sub={`$${overview.revenue_30d_usd.toFixed(0)} revenue (30d)`} />
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-boss-green">
            Packages received over time (30d)
          </h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={(l) => String(l)} />
                <Line type="monotone" dataKey="count" stroke="#eab308" strokeWidth={2} dot={false} name="Received" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-boss-green">
            Pre-alerts vs packages received (30d)
          </h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compare}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={(l) => String(l)} />
                <Legend />
                <Bar dataKey="pre_alerts" fill="#eab308" name="Pre-alerts" radius={[2, 2, 0, 0]} />
                <Bar dataKey="received" fill="#22c55e" name="Received" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-boss-green">Packages by status</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statuses} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={80} label>
                  {statuses.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-boss-green">Weight distribution</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weights}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#eab308" name="Packages" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-boss-green">Recent clerk activity</h2>
          <Link to="/warehouse/activity" className="text-sm text-boss-green hover:underline">
            View all →
          </Link>
        </div>
        {recentActivity.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No package actions logged yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {recentActivity.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-medium">{entry.summary}</p>
                  <p className="text-xs text-muted">
                    {entry.actor_name} · {entry.actor_role}
                  </p>
                </div>
                <p className="text-xs text-muted">
                  {new Date(entry.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
