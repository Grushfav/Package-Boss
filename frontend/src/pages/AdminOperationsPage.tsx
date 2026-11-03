import {
  Activity,
  BarChart3,
  Landmark,
  Minus,
  TrendingDown,
  TrendingUp,
  Truck,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
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
import { formatAppDateTime } from '../lib/datetime'
import { formatJmd } from '../lib/money'
import {
  fetchActivityLog,
  fetchAdminOverview,
  fetchMonthlyGrowth,
  fetchPackagesByStatus,
  fetchPackagesTimeline,
  fetchPreAlertsVsReceives,
  fetchWeightDistribution,
} from '../api/admin'
import { IconBadge } from '../components/ui/IconBadge'
import type { AdminOverview, AuditLogEntry, MonthlyGrowthPoint } from '../types'

const CHART_COLORS = ['#eab308', '#ca8a04', '#22c55e', '#3b82f6', '#a855f7', '#64748b']

function formatShortDate(dateStr: string) {
  return dateStr.slice(5)
}

function formatPercent(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`
}

function shortMonthLabel(label: string) {
  return label.split(' ')[0] ?? label
}

function momDelta(current: number, previous: number) {
  if (previous === 0) {
    if (current === 0) return { pct: 0, direction: 'flat' as const, isNew: false }
    return { pct: null, direction: 'up' as const, isNew: true }
  }
  const pct = ((current - previous) / previous) * 100
  if (Math.abs(pct) < 0.05) return { pct: 0, direction: 'flat' as const, isNew: false }
  return {
    pct,
    direction: pct > 0 ? ('up' as const) : ('down' as const),
    isNew: false,
  }
}

function CompareStat({
  label,
  count,
  percent,
  colorClass,
}: {
  label: string
  count: number
  percent: number
  colorClass: string
}) {
  return (
    <div className="rounded-xl border border-border bg-background/50 p-4">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${colorClass}`} />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      </div>
      <p className="mt-2 text-3xl font-black tabular-nums text-boss-green">{count}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-boss-green">{formatPercent(percent)}</p>
    </div>
  )
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 text-3xl font-black text-boss-green">{value}</p>
      {sub && <p className="mt-1 text-xs text-boss-green">{sub}</p>}
    </div>
  )
}

function ReceivedPackagesCard({
  today,
  week,
  month,
  total,
}: {
  today: number
  week: number
  month: number
  total: number
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">Packages received</p>
      <p className="mt-2 text-3xl font-black tabular-nums text-boss-green">{today}</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
        <p>
          7d{' '}
          <span className="font-semibold tabular-nums text-boss-green">{week}</span>
        </p>
        <p>
          30d{' '}
          <span className="font-semibold tabular-nums text-boss-green">{month}</span>
        </p>
        <p>
          Total{' '}
          <span className="font-semibold tabular-nums text-boss-green">{total.toLocaleString()}</span>
        </p>
      </div>
    </div>
  )
}

function isEarlyMonth() {
  return new Date().getDate() <= 5
}

function MomChangeBadge({
  current,
  previous,
  invertGood,
}: {
  current: number
  previous: number
  invertGood?: boolean
}) {
  const delta = momDelta(current, previous)
  const good =
    delta.direction === 'flat'
      ? null
      : invertGood
        ? delta.direction === 'down'
        : delta.direction === 'up'
  const color =
    delta.direction === 'flat'
      ? 'text-muted'
      : good
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-rose-600 dark:text-rose-400'
  const Icon =
    delta.direction === 'up' ? TrendingUp : delta.direction === 'down' ? TrendingDown : Minus

  // Early-month % compares partial MTD to a full prior month — hide the number.
  if (!delta.isNew && isEarlyMonth()) {
    return (
      <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-muted">
        <Minus className="h-3.5 w-3.5" aria-hidden />
        MTD in progress · vs prior month
      </p>
    )
  }

  return (
    <p className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold tabular-nums ${color}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {delta.isNew
        ? 'New this month (MTD)'
        : delta.pct === null
          ? '—'
          : `${delta.pct > 0 ? '+' : ''}${delta.pct.toFixed(0)}% MTD vs prior month`}
    </p>
  )
}

function MomMetricCard({
  icon: Icon,
  label,
  value,
  current,
  previous,
  hint,
}: {
  icon: typeof Users
  label: string
  value: string
  current: number
  previous: number
  hint: string
}) {
  return (
    <div className="rounded-xl border border-border bg-background/50 p-4">
      <div className="flex items-center gap-2">
        <IconBadge icon={Icon} size="sm" />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      </div>
      <p className="mt-2 text-3xl font-black tabular-nums text-boss-green">{value}</p>
      <MomChangeBadge current={current} previous={previous} />
      <p className="mt-1 text-[11px] text-muted">{hint}</p>
    </div>
  )
}

function SubmissionStatsSection({
  title,
  description,
  icon: Icon,
  active,
  today,
  total,
  activeLabel = 'Active requests',
}: {
  title: string
  description: string
  icon: typeof Truck
  active?: number
  today?: number
  total?: number
  activeLabel?: string
}) {
  return (
    <div>
      <div className="mt-3 flex items-center gap-2">
        <IconBadge icon={Icon} size="sm" />
        <div className="min-w-0">
          <h3 className="text-xs font-bold uppercase tracking-wide text-boss-green">{title}</h3>
          <p className="truncate text-[11px] text-muted">{description}</p>
        </div>
      </div>
      <div className="mt-3 rounded-xl border border-border bg-background/50 p-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{activeLabel}</p>
        <p className="mt-1 text-3xl font-black tabular-nums text-boss-green">{active ?? '—'}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-0.5 text-xs text-muted">
          <p>
            Today{' '}
            <span className="font-semibold tabular-nums text-boss-green">{today ?? '—'}</span>
          </p>
          <p>
            Total{' '}
            <span className="font-semibold tabular-nums text-boss-green">{total ?? '—'}</span>
          </p>
        </div>
      </div>
    </div>
  )
}

export function AdminOperationsPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [timeline, setTimeline] = useState<{ date: string; count: number }[]>([])
  const [statuses, setStatuses] = useState<{ label: string; count: number }[]>([])
  const [weights, setWeights] = useState<{ label: string; count: number }[]>([])
  const [compare, setCompare] = useState<{ date: string; pre_alerts: number; received: number }[]>([])
  const [monthlyGrowth, setMonthlyGrowth] = useState<MonthlyGrowthPoint[]>([])
  const [momLoadState, setMomLoadState] = useState<'loading' | 'ready' | 'error' | 'empty'>('loading')
  const [recentActivity, setRecentActivity] = useState<AuditLogEntry[]>([])

  useEffect(() => {
    fetchAdminOverview().then(setOverview).catch(() => {})
    fetchPackagesTimeline(30).then(setTimeline).catch(() => {})
    fetchPackagesByStatus().then((s) => setStatuses(s.map((x) => ({ label: x.label, count: x.count })))).catch(() => {})
    fetchWeightDistribution().then(setWeights).catch(() => {})
    fetchPreAlertsVsReceives(30).then(setCompare).catch(() => {})
    fetchMonthlyGrowth(12)
      .then((data) => {
        setMonthlyGrowth(data.series)
        setMomLoadState(data.series.length === 0 ? 'empty' : 'ready')
      })
      .catch(() => {
        setMonthlyGrowth([])
        setMomLoadState('error')
      })
    fetchActivityLog(8, 0).then((d) => setRecentActivity(d.activity)).catch(() => {})
  }, [])

  const preAlertsVsReceived = useMemo(() => {
    const preAlerts = compare.reduce((sum, day) => sum + day.pre_alerts, 0)
    const received = compare.reduce((sum, day) => sum + day.received, 0)
    const total = preAlerts + received
    return {
      preAlerts,
      received,
      preAlertsPercent: total > 0 ? (preAlerts / total) * 100 : 0,
      receivedPercent: total > 0 ? (received / total) * 100 : 0,
    }
  }, [compare])

  const momSummary = useMemo(() => {
    if (monthlyGrowth.length === 0) return null
    const current = monthlyGrowth[monthlyGrowth.length - 1]
    const previous = monthlyGrowth[monthlyGrowth.length - 2] ?? {
      active_customers: 0,
      revenue_jmd: 0,
      label: '—',
      month: '',
    }
    return { current, previous }
  }, [monthlyGrowth])

  const chartSeries = useMemo(
    () =>
      monthlyGrowth.map((point) => ({
        ...point,
        shortLabel: shortMonthLabel(point.label),
      })),
    [monthlyGrowth],
  )

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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ReceivedPackagesCard
            today={overview.packages_today}
            week={overview.packages_7d}
            month={overview.packages_30d}
            total={overview.packages_total}
          />
          <KpiCard label="Pending pre-alerts" value={overview.pending_pre_alerts} />
          <KpiCard label="In transit" value={overview.in_transit} />
          <KpiCard
            label="Est. package value (30d)"
            value={formatJmd(overview.revenue_30d_usd)}
            sub="Estimated from packages received · not checkout collections"
          />
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2.5">
            <IconBadge icon={UserPlus} size="sm" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-boss-green">
                New customers
              </h2>
              <p className="text-xs text-muted">Customer signups (excludes staff accounts)</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Today', value: overview?.customers_today },
              { label: 'Last 7 days', value: overview?.customers_7d },
              { label: 'Total', value: overview?.customers_total },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-border bg-background/50 p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  {stat.label}
                </p>
                <p className="mt-2 text-3xl font-black tabular-nums text-boss-green">
                  {stat.value ?? '—'}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2.5">
            <IconBadge icon={TrendingUp} size="sm" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-boss-green">
                This month (MTD)
              </h2>
              <p className="text-xs text-muted">
                MTD vs prior full month · active shippers & collected checkout totals
              </p>
            </div>
          </div>
          {momLoadState === 'loading' ? (
            <p className="mt-5 text-sm text-muted">Loading month-over-month figures…</p>
          ) : momLoadState === 'error' ? (
            <p className="mt-5 text-sm text-muted">Couldn’t load month-over-month figures.</p>
          ) : momLoadState === 'empty' || !momSummary ? (
            <p className="mt-5 text-sm text-muted">No month-over-month data yet.</p>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <MomMetricCard
                icon={Users}
                label="Active customers"
                value={String(momSummary.current.active_customers)}
                current={momSummary.current.active_customers}
                previous={momSummary.previous.active_customers}
                hint={`${momSummary.current.label} (MTD) · customers with packages received`}
              />
              <MomMetricCard
                icon={Wallet}
                label="Checkout revenue collected"
                value={formatJmd(momSummary.current.revenue_jmd)}
                current={momSummary.current.revenue_jmd}
                previous={momSummary.previous.revenue_jmd}
                hint={`${momSummary.current.label} (MTD) · recorded checkout totals`}
              />
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-boss-green">
          Customer requests
        </h2>
        <p className="mt-1 text-xs text-muted">
          All submissions by request date (any status)
        </p>
        <Link
          to="/warehouse/requests"
          className="mt-4 grid grid-cols-2 gap-4 rounded-xl transition-colors hover:bg-background/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-boss-gold"
          aria-label="Open customer requests queue"
        >
          <SubmissionStatsSection
            title="Delivery requests"
            description="Home delivery requests submitted by customers"
            icon={Truck}
            active={overview?.delivery_requests_active}
            today={overview?.delivery_requests_today}
            total={overview?.delivery_requests_total}
          />
          <SubmissionStatsSection
            title="Payment proofs"
            description="Bank transfer proof uploads submitted by customers"
            icon={Landmark}
            active={overview?.bank_transfer_proofs_active}
            today={overview?.bank_transfer_proofs_today}
            total={overview?.bank_transfer_proofs_total}
            activeLabel="Active proofs"
          />
        </Link>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-boss-green">
            Active customers by month
          </h2>
          <p className="mt-1 text-xs text-muted">
            Distinct customers with at least one package received
          </p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="shortLabel" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
                <Tooltip
                  labelFormatter={(_, payload) =>
                    String(payload?.[0]?.payload?.label ?? '')
                  }
                  formatter={(value) => [value ?? 0, 'Active customers']}
                />
                <Bar
                  dataKey="active_customers"
                  fill="#22c55e"
                  name="Active customers"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-boss-green">
            Checkout revenue by month
          </h2>
          <p className="mt-1 text-xs text-muted">
            Collected checkout totals (JMD) · current month is MTD
          </p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="shortLabel" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  width={52}
                  tickFormatter={(v) =>
                    Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : String(v)
                  }
                />
                <Tooltip
                  labelFormatter={(_, payload) =>
                    String(payload?.[0]?.payload?.label ?? '')
                  }
                  formatter={(value) => [formatJmd(Number(value ?? 0)), 'Revenue']}
                />
                <Bar
                  dataKey="revenue_jmd"
                  fill="#eab308"
                  name="Revenue"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

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
          <p className="mt-1 text-xs text-muted">Share of activity in the last 30 days</p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <CompareStat
              label="Pre-alerts"
              count={preAlertsVsReceived.preAlerts}
              percent={preAlertsVsReceived.preAlertsPercent}
              colorClass="bg-boss-gold"
            />
            <CompareStat
              label="Received"
              count={preAlertsVsReceived.received}
              percent={preAlertsVsReceived.receivedPercent}
              colorClass="bg-boss-green"
            />
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-boss-green">Packages by status</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statuses}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="42%"
                  outerRadius={72}
                  label={({ value }) =>
                    typeof value === 'number' && value > 0 ? String(value) : ''
                  }
                >
                  {statuses.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                />
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
                  {formatAppDateTime(entry.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
