import { useEffect, useState } from 'react'
import { getErrorMessage } from '../../api/client'
import { api } from '../../api/client'
import { changePassword, updateProfile } from '../../api/profile'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

export function ProfileSection() {
  const { user, refreshUser } = useAuth()
  const [parishes, setParishes] = useState<string[]>([])
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

  useEffect(() => {
    if (!user) return
    setFirstName(user.first_name)
    setLastName(user.last_name)
    setContactNumber(user.contact_number)
    setParish(user.parish)
  }, [user])

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

  return (
    <div>
      <h2 className="text-lg font-bold uppercase tracking-wide">My Profile</h2>
      <p className="mt-2 text-sm text-muted">
        Update your contact details. Email, BOSS ID, and TRN cannot be changed here.
      </p>

      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>
      )}
      {success && (
        <p className="mt-3 rounded-lg bg-boss-green/10 px-4 py-2 text-sm text-boss-green">
          {success}
        </p>
      )}

      <form
        onSubmit={handleProfileSubmit}
        className="mt-4 space-y-4 rounded-xl border border-border bg-card p-5"
      >
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
            label="Email"
            value={user.email}
            disabled
            className="sm:col-span-2 opacity-70"
          />
          <Input
            label="Contact number"
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
          <Input
            label="BOSS ID"
            value={user.shipping_id}
            disabled
            className="opacity-70"
          />
          {user.trn_masked && (
            <Input label="TRN on file" value={user.trn_masked} disabled className="opacity-70" />
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save profile'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowPasswordForm((v) => !v)}
          >
            {showPasswordForm ? 'Cancel password change' : 'Change password'}
          </Button>
        </div>
      </form>

      {showPasswordForm && (
        <form
          onSubmit={handlePasswordSubmit}
          className="mt-4 space-y-4 rounded-xl border border-border bg-card p-5"
        >
          <h3 className="text-sm font-bold uppercase tracking-wide">Change password</h3>
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
          <Button type="submit" disabled={loading}>
            {loading ? 'Updating...' : 'Update password'}
          </Button>
        </form>
      )}
    </div>
  )
}
