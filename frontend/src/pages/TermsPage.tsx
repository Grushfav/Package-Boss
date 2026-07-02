import { COMPANY_LEGAL_NAME, TERMS_EFFECTIVE_DATE, TERMS_SECTIONS } from '../content/terms'
import { LegalDocumentPage } from '../components/legal/LegalDocumentPage'

export function TermsPage() {
  return (
    <LegalDocumentPage
      title="Terms & Conditions"
      subtitle={COMPANY_LEGAL_NAME}
      effectiveDate={TERMS_EFFECTIVE_DATE}
      sections={TERMS_SECTIONS}
      relatedLinks={[
        { label: 'Privacy Policy', to: '/privacy' },
        { label: 'Data Protection Policy', to: '/data-protection' },
      ]}
    />
  )
}
