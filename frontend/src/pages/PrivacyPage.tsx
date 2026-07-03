import { COMPANY_LEGAL_NAME } from '../content/terms'
import { LEGAL_EFFECTIVE_DATE } from '../content/legal'
import { PRIVACY_SECTIONS } from '../content/privacy'
import { LegalDocumentPage } from '../components/legal/LegalDocumentPage'
import { Seo } from '../components/seo/Seo'
import { PAGE_SEO } from '../lib/seo'

export function PrivacyPage() {
  return (
    <>
      <Seo {...PAGE_SEO.privacy} />
      <LegalDocumentPage
      title="Privacy Policy"
      subtitle={COMPANY_LEGAL_NAME}
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      sections={PRIVACY_SECTIONS}
      relatedLinks={[
        { label: 'Terms & Conditions', to: '/terms' },
        { label: 'Data Protection Policy', to: '/data-protection' },
      ]}
    />
    </>
  )
}
