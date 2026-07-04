import { Link } from 'react-router-dom'
import type { LegalSection } from '../../content/legal'
import { PRIVACY_EMAIL } from '../../content/legal'

function LegalParagraph({ text }: { text: string }) {
  const urlMatch = text.match(/(https:\/\/\S+)/)
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)

  if (urlMatch) {
    const [before, after] = text.split(urlMatch[1])
    return (
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {before}
        <a
          href={urlMatch[1]}
          className="text-boss-gold hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {urlMatch[1]}
        </a>
        {after}
      </p>
    )
  }

  if (emailMatch) {
    const [before, after] = text.split(emailMatch[1])
    return (
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {before}
        <a href={`mailto:${emailMatch[1]}`} className="text-boss-gold hover:underline">
          {emailMatch[1]}
        </a>
        {after}
      </p>
    )
  }

  return <p className="mt-3 text-sm leading-relaxed text-muted">{text}</p>
}

export interface LegalDocumentPageProps {
  title: string
  subtitle: string
  effectiveDate: string
  sections: LegalSection[]
  relatedLinks?: { label: string; to: string }[]
}

export function LegalDocumentPage({
  title,
  subtitle,
  effectiveDate,
  sections,
  relatedLinks = [],
}: LegalDocumentPageProps) {
  return (
    <div className="px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-black uppercase">{title}</h1>
        <p className="mt-2 text-sm text-muted">
          {subtitle} · Effective {effectiveDate}
        </p>

        {relatedLinks.length > 0 && (
          <nav className="mt-6 flex flex-wrap gap-4 text-sm">
            {relatedLinks.map((link) => (
              <Link key={link.to} to={link.to} className="text-boss-gold hover:underline">
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-bold text-boss-gold">{section.title}</h2>
              {section.paragraphs?.map((p) => (
                <LegalParagraph key={p.slice(0, 48)} text={p} />
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
          <a href={`mailto:${PRIVACY_EMAIL}`} className="text-boss-gold hover:underline">
            {PRIVACY_EMAIL}
          </a>
          .{' '}
          <Link to="/signup" className="text-boss-gold hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}
