import { COMPANY_LEGAL_NAME } from '../content/terms'
import { LEGAL_EFFECTIVE_DATE } from '../content/legal'
import { DATA_PROTECTION_SECTIONS } from '../content/dataProtection'
import { LegalDocumentPage } from '../components/legal/LegalDocumentPage'

export function DataProtectionPage() {
  return (
    <LegalDocumentPage
      title="Data Protection Policy"
      subtitle={COMPANY_LEGAL_NAME}
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      sections={DATA_PROTECTION_SECTIONS}
      relatedLinks={[
        { label: 'Privacy Policy', to: '/privacy' },
        { label: 'Terms & Conditions', to: '/terms' },
      ]}
    />
  )
}
