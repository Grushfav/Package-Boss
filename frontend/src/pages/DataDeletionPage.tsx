import { COMPANY_LEGAL_NAME } from '../content/terms'
import { LEGAL_EFFECTIVE_DATE } from '../content/legal'
import {
  DATA_DELETION_EMAIL,
  DATA_DELETION_MAILTO,
  DATA_DELETION_SECTIONS,
} from '../content/dataDeletion'
import { LegalDocumentPage } from '../components/legal/LegalDocumentPage'
import { Seo } from '../components/seo/Seo'
import { PAGE_SEO } from '../lib/seo'

export function DataDeletionPage() {
  return (
    <>
      <Seo {...PAGE_SEO.dataDeletion} />
      <div className="px-4 pt-12">
        <div className="mx-auto max-w-3xl">
          <a
            href={DATA_DELETION_MAILTO}
            className="inline-flex items-center justify-center rounded-xl bg-boss-gold px-5 py-3 text-sm font-bold uppercase tracking-wide text-boss-navy hover:opacity-90"
          >
            Email {DATA_DELETION_EMAIL}
          </a>
          <p className="mt-3 text-sm text-muted">
            Opens your email app with subject “Data deletion request”. Include your name, BOSS ID,
            and account email.
          </p>
        </div>
      </div>
      <LegalDocumentPage
        title="Data deletion request"
        subtitle={COMPANY_LEGAL_NAME}
        effectiveDate={LEGAL_EFFECTIVE_DATE}
        sections={DATA_DELETION_SECTIONS}
        relatedLinks={[
          { label: 'Privacy Policy', to: '/privacy' },
          { label: 'Data Protection Policy', to: '/data-protection' },
          { label: 'Terms & Conditions', to: '/terms' },
        ]}
      />
    </>
  )
}
