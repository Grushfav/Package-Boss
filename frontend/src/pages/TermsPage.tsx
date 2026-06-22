import { Link } from 'react-router-dom'
import {
  COMPANY_LEGAL_NAME,
  TERMS_EFFECTIVE_DATE,
  TERMS_SECTIONS,
} from '../content/terms'

function TermsParagraph({ text }: { text: string }) {
  const urlMatch = text.match(/(https:\/\/\S+)/)
  if (!urlMatch) {
    return <p className="mt-3 text-sm leading-relaxed text-muted">{text}</p>
  }

  const [before, after] = text.split(urlMatch[1])
  return (
    <p className="mt-3 text-sm leading-relaxed text-muted">
      {before}
      <a
        href={urlMatch[1]}
        className="text-boss-green hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        Jamaica Customs — Duties &amp; Taxes
      </a>
      {after}
    </p>
  )
}

export function TermsPage() {
  return (
    <div className="px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-black uppercase">Terms &amp; Conditions</h1>
        <p className="mt-2 text-sm text-muted">
          {COMPANY_LEGAL_NAME} · Effective {TERMS_EFFECTIVE_DATE}
        </p>

        <div className="mt-10 space-y-8">
          {TERMS_SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-bold text-boss-green">{section.title}</h2>
              {section.paragraphs?.map((p) => (
                <TermsParagraph key={p.slice(0, 48)} text={p} />
              ))}
              {section.bullets && (
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
                  {section.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <p className="mt-12 border-t border-border pt-6 text-center text-sm text-muted">
          Questions? Contact us at{' '}
          <a href="mailto:support@packageboss.com" className="text-boss-green hover:underline">
            support@packageboss.com
          </a>
          .{' '}
          <Link to="/signup" className="text-boss-green hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}
