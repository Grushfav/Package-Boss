import { Helmet } from 'react-helmet-async'
import {
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  absoluteUrl,
  organizationJsonLd,
  type PageSeo,
} from '../../lib/seo'

interface SeoProps extends PageSeo {
  /** Include Organization JSON-LD (use on homepage). */
  includeOrganization?: boolean
  ogImage?: string
}

export function Seo({
  title,
  description,
  path,
  noindex = false,
  includeOrganization = false,
  ogImage = DEFAULT_OG_IMAGE,
}: SeoProps) {
  const canonical = absoluteUrl(path)
  const robots = noindex ? 'noindex, nofollow' : 'index, follow'

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robots} />
      <link rel="canonical" href={canonical} />

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {includeOrganization && (
        <script type="application/ld+json">{JSON.stringify(organizationJsonLd())}</script>
      )}
    </Helmet>
  )
}
