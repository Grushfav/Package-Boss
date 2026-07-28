import { Landmark } from 'lucide-react'
import { BankTransferDetailsContent } from '../../components/account/BankTransferDetailsCard'
import { IconBadge } from '../../components/ui/IconBadge'

export function DashboardBankTransferPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2.5">
        <IconBadge icon={Landmark} size="sm" />
        <h2 className="text-lg font-bold uppercase tracking-wide">Bank transfer details</h2>
      </div>
      <BankTransferDetailsContent />
    </div>
  )
}
