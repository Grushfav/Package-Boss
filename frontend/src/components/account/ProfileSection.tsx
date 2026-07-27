import { KeyRound, Mail, MapPin, Phone, Pencil, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getErrorMessage } from '../../api/client'
import { api } from '../../api/client'
import { changePassword, updateProfile } from '../../api/profile'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

function DetailRow({
  label,
  value,
  icon: Icon,
  mono = false,
}: {
  label: string
  value: string
  icon?: typeof User
  mono?: boolean
}) {
  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      {Icon && (
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-boss-gold/10 text-boss-gold">
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
        <p className={`mt-0.5 text-sm font-semibold text-foreground ${mono ? 'font-mono' : ''}`}>
          {value || '—'}
        </p>
      </div>
    </div>
  )
}

function profileInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

export function ProfileSection() {
  const { user, refreshUser } = useAuth()
  const [parishes, setParishes] = useState<string[]>([])
  const [editing, setEditing] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [parish, setParish] = useState('')
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get<{ parishes: string[] }>('/parishes').then(({ data }) => setParishes(data.parishes))
  }, [])

  function syncFromUser() {
    if (!user) return
    setFirstName(user.first_name)
    setLastName(user.last_name)
    setContactNumber(user.contact_number)
    setParish(user.parish)
  }

  useEffect(() => {
    syncFromUser()
  }, [user])

  function startEditing() {
    syncFromUser()
    setEditing(true)
    setError('')
    setSuccess('')
  }

  function cancelEditing() {
    syncFromUser()
    setEditing(false)
    setError('')
  }

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      await updateProfile({
        first_name: firstName,
        last_name: lastName,
        contact_number: contactNumber,
        parish,
      })
      await refreshUser()
      setEditing(false)
      setSuccess('Profile updated')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }
    setLoading(true)
    try {
      await changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordForm(false)
      setSuccess('Password updated')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  const displayName = user.full_name || `${user.first_name} ${user.last_name}`.trim()

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-gradient-to-br from-boss-gold/10 via-card to-card px-6 py-6 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <span
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-boss-gold text-xl font-black text-black"
                aria-hidden
              >
                {profileInitials(user.first_name, user.last_name)}
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-boss-gold">
                  Boss Member
                </p>
                <h2 className="mt-1 text-2xl font-black uppercase tracking-tight">{displayName}</h2>
                <p className="mt-2 font-mono text-sm font-bold text-boss-gold">{user.shipping_id}</p>
              </div>
            </div>
            {!editing && (
              <Button type="button" variant="outline" onClick={startEditing} className="inline-flex items-center gap-2">
                <Pencil className="h-4 w-4" />
                Edit profile
              </Button>
            )}
          </div>
        </div>

        {error && (
          <p className="mx-6 mt-4 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400 sm:mx-8">
            {error}
          </p>
        )}
        {success && (
          <p className="mx-6 mt-4 rounded-lg bg-boss-green/10 px-4 py-2 text-sm text-boss-green sm:mx-8">
            {success}
          </p>
        )}

        {editing ? (
          <form onSubmit={handleProfileSubmit} className="space-y-4 px-6 py-6 sm:px-8">
            <p className="text-sm text-muted">Update the details we use for delivery and account contact.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
              <Input
                label="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
              <Input
                label="Contact number"
                type="tel"
                placeholder="+18765551234 or +19545551234"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                required
              />
              <div className="space-y-1.5">
                <label className="block text-xs font-medium uppercase tracking-wider text-muted">
                  Parish
                </label>
                <select
                  value={parish}
                  onChange={(e) => setParish(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm"
                >
                  <option value="">Select parish</option>
                  {parishes.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 border-t border-border pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving…' : 'Save changes'}
              </Button>
              <Button type="button" variant="outline" onClick={cancelEditing} disabled={loading}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="grid gap-0 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <div className="px-6 py-5 sm:px-8">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted">Contact</h3>
              <dl className="mt-3 divide-y divide-border">
                <DetailRow label="Phone" value={user.contact_number} icon={Phone} />
                <DetailRow label="Parish" value={user.parish} icon={MapPin} />
              </dl>
            </div>
            <div className="px-6 py-5 sm:px-8">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted">Account</h3>
              <dl className="mt-3 divide-y divide-border">
                <DetailRow label="Email" value={user.email} icon={Mail} />
                <DetailRow label="BOSS ID" value={user.shipping_id} icon={User} mono />
                {user.trn && <DetailRow label="TRN on file" value={user.trn} mono />}
              </dl>
              <p className="mt-4 text-xs text-muted">
                Email, BOSS ID, and TRN cannot be changed here. Contact support if something is wrong.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background text-muted">
              <KeyRound className="h-5 w-5" strokeWidth={2} />
            </span>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide">Security</h3>
              <p className="mt-1 text-sm text-muted">Update your password to keep your account secure.</p>
            </div>
          </div>
          {!showPasswordForm && (
            <Button
              type="button"
              variant="outline"
              className="!text-xs"
              onClick={() => {
                setShowPasswordForm(true)
                setError('')
              }}
            >
              Change password
            </Button>
          )}
        </div>

        {showPasswordForm && (
          <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4 border-t border-border pt-6">
            <Input
              label="Current password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <Input
              label="New password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <Input
              label="Confirm new password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={loading}>
                {loading ? 'Updating…' : 'Update password'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowPasswordForm(false)
                  setCurrentPassword('')
                  setNewPassword('')
                  setConfirmPassword('')
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
