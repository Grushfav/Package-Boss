import { Shield, UserPlus, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  createClerk,
  deactivateClerk,
  fetchClerkPermissionOptions,
  fetchClerks,
  resendClerkInvite,
  updateClerk,
  type ClerkPermissionOption,
} from '../api/admin'
import { api } from '../api/client'
import { getErrorMessage } from '../api/client'
import { Button } from '../components/ui/Button'
import { IconBadge } from '../components/ui/IconBadge'
import { Input } from '../components/ui/Input'
import { DEFAULT_CLERK_PERMISSIONS } from '../lib/clerkPermissions'
import type { ClerkPermission, User } from '../types'

export function AdminClerksPage() {
  const [clerks, setClerks] = useState<User[]>([])
  const [permissionOptions, setPermissionOptions] = useState<ClerkPermissionOption[]>([])
  const [parishes, setParishes] = useState<string[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    contact_number: '',
    parish: '',
    permissions: [...DEFAULT_CLERK_PERMISSIONS] as ClerkPermission[],
  })

  useEffect(() => {
    fetchClerks().then(setClerks).catch(() => {})
    fetchClerkPermissionOptions().then(setPermissionOptions).catch(() => {})
    api.get<{ parishes: string[] }>('/parishes').then(({ data }) => setParishes(data.parishes))
  }, [])

  function togglePermission(code: ClerkPermission) {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(code)
        ? prev.permissions.filter((p) => p !== code)
        : [...prev.permissions, code],
    }))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const clerk = await createClerk({
        email: form.email,
        first_name: form.first_name,
        last_name: form.last_name,
        contact_number: form.contact_number || undefined,
        parish: form.parish || undefined,
        permissions: form.permissions,
      })
      setClerks((prev) => [clerk, ...prev])
      setForm({
        email: '',
        first_name: '',
        last_name: '',
        contact_number: '',
        parish: '',
        permissions: [...DEFAULT_CLERK_PERMISSIONS],
      })
      setSuccess(`Created ${clerk.full_name}. An invite email was sent to set their password.`)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handlePermissionChange(clerk: User, permissions: ClerkPermission[]) {
    setError('')
    setSuccess('')
    try {
      const updated = await updateClerk(clerk.id, { permissions })
      setClerks((prev) => prev.map((c) => (c.id === clerk.id ? updated : c)))
      setSuccess(`Updated permissions for ${updated.full_name}.`)
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  async function handleResendInvite(clerkId: string) {
    setError('')
    setSuccess('')
    try {
      await resendClerkInvite(clerkId)
      setSuccess('Invite email sent.')
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  async function handleDeactivate(clerkId: string) {
    setError('')
    setSuccess('')
    try {
      await deactivateClerk(clerkId)
      setClerks((prev) => prev.filter((c) => c.id !== clerkId))
      setSuccess('Clerk account deactivated.')
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center gap-2.5">
        <IconBadge icon={Shield} size="sm" />
        <div>
          <h1 className="text-2xl font-black uppercase">Manage Clerks</h1>
          <p className="text-sm text-muted">Create accounts and assign warehouse permissions</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-boss-green">
          <UserPlus className="h-4 w-4" />
          Create clerk account
        </h2>
        <p className="mt-2 text-sm text-muted">
          The clerk will receive an email to set their password (link expires in 24 hours).
        </p>
        <form onSubmit={handleCreate} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="First name"
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              required
            />
            <Input
              label="Last name"
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              required
            />
          </div>
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <Input
            label="Contact (876, optional)"
            value={form.contact_number}
            onChange={(e) => setForm({ ...form, contact_number: e.target.value })}
          />
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted">
              Parish (optional)
            </label>
            <select
              value={form.parish}
              onChange={(e) => setForm({ ...form, parish: e.target.value })}
              className="w-full rounded-lg border border-border bg-input px-4 py-3 text-foreground focus:border-boss-green focus:outline-none focus:ring-1 focus:ring-boss-green"
            >
              <option value="">— None —</option>
              {parishes.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <PermissionCheckboxes
            options={permissionOptions}
            selected={form.permissions}
            onToggle={togglePermission}
          />

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? 'Creating…' : 'Create clerk & send invite'}
          </Button>
        </form>

        {error && (
          <p className="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
        )}
        {success && (
          <p className="mt-4 rounded-lg bg-boss-green/10 px-4 py-3 text-sm text-boss-green">
            {success}
          </p>
        )}
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-boss-green">
          <Users className="h-4 w-4" />
          Current clerks ({clerks.length})
        </h2>
        {clerks.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No clerks yet.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {clerks.map((clerk) => (
              <ClerkRow
                key={clerk.id}
                clerk={clerk}
                permissionOptions={permissionOptions}
                onSavePermissions={handlePermissionChange}
                onResendInvite={handleResendInvite}
                onDeactivate={handleDeactivate}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function PermissionCheckboxes({
  options,
  selected,
  onToggle,
}: {
  options: ClerkPermissionOption[]
  selected: ClerkPermission[]
  onToggle: (code: ClerkPermission) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">Permissions</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((opt) => (
          <label
            key={opt.code}
            className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              checked={selected.includes(opt.code)}
              onChange={() => onToggle(opt.code)}
              className="mt-0.5 accent-boss-green"
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function ClerkRow({
  clerk,
  permissionOptions,
  onSavePermissions,
  onResendInvite,
  onDeactivate,
}: {
  clerk: User
  permissionOptions: ClerkPermissionOption[]
  onSavePermissions: (clerk: User, permissions: ClerkPermission[]) => void
  onResendInvite: (id: string) => void
  onDeactivate: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [permissions, setPermissions] = useState<ClerkPermission[]>(
    clerk.clerk_permissions || clerk.permissions || [...DEFAULT_CLERK_PERMISSIONS],
  )

  return (
    <li className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{clerk.full_name}</p>
          <p className="text-sm text-muted">{clerk.email}</p>
          {clerk.must_set_password && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Awaiting password setup</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {clerk.must_set_password && (
            <Button
              variant="outline"
              onClick={() => onResendInvite(clerk.id)}
              className="!py-2 !text-xs"
            >
              Resend invite
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setExpanded((v) => !v)}
            className="!py-2 !text-xs"
          >
            {expanded ? 'Hide permissions' : 'Edit permissions'}
          </Button>
          <Button
            variant="outline"
            onClick={() => onDeactivate(clerk.id)}
            className="!py-2 !text-xs"
          >
            Deactivate
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="mt-4 border-t border-border pt-4">
          <PermissionCheckboxes
            options={permissionOptions}
            selected={permissions}
            onToggle={(code) =>
              setPermissions((prev) =>
                prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code],
              )
            }
          />
          <Button
            className="mt-3 !text-xs"
            onClick={() => onSavePermissions(clerk, permissions)}
          >
            Save permissions
          </Button>
        </div>
      )}
    </li>
  )
}
