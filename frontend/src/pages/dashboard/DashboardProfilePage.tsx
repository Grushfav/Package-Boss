import { DeliveryAddressesSection } from '../../components/account/DeliveryAddressesSection'
import { AuthorizedPickupsSection } from '../../components/account/AuthorizedPickupsSection'
import { ProfileSection } from '../../components/account/ProfileSection'

export function DashboardProfilePage() {
  return (
    <div className="space-y-10">
      <ProfileSection />
      <DeliveryAddressesSection />
      <AuthorizedPickupsSection />
    </div>
  )
}
