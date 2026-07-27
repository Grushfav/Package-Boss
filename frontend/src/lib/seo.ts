import { COMPANY_PHONE_TEL } from '../content/legal'

export const SITE_NAME = 'Package Boss'
export const SITE_LEGAL_NAME = 'Package Boss Shipping & Logistics'
export const DEFAULT_TITLE = 'Package Boss — Ship Smart. Ship Easy.'
export const DEFAULT_DESCRIPTION =
  'Package shipping from Fort Lauderdale, Florida to Jamaica. Get a US warehouse address, view your shipments in your dashboard, view rates, and ship three times per week. Sign up free.'

/** Production site URL — override with VITE_SITE_URL in Render env. */
export const SITE_URL = (
  import.meta.env.VITE_SITE_URL as string | undefined
)?.replace(/\/$/, '') || 'https://www.packagebossja.com'

export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`

export interface PageSeo {
  title: string
  description: string
  path: string
  noindex?: boolean
}

export const PAGE_SEO = {
  home: {
    title: 'Package Boss — US to Jamaica Shipping from Fort Lauderdale',
    description: DEFAULT_DESCRIPTION,
    path: '/',
  },
  about: {
    title: 'About Package Boss — Fort Lauderdale to Jamaica Freight Forwarding',
    description:
      'Learn how Package Boss connects US online shopping to Jamaica with a Fort Lauderdale warehouse, three weekly departures, tracking, and reliable delivery.',
    path: '/about',
  },
  services: {
    title: 'Shipping Services — Tracking, Notifications & Delivery | Package Boss',
    description:
      'Comprehensive package tracking, email and WhatsApp updates, and delivery options for shipments from Fort Lauderdale, Florida to Jamaica.',
    path: '/services',
  },
  rates: {
    title: 'Shipping Rates — Fort Lauderdale to Jamaica (USD & JMD) | Package Boss',
    description:
      'View tiered freight rates from Fort Lauderdale to Kingston. Transparent pricing in USD and JMD. Packages over 50 lbs require a custom quote.',
    path: '/rates',
  },
  signup: {
    title: 'Sign Up — Get Your Fort Lauderdale Shipping Address | Package Boss',
    description:
      'Create a free Package Boss account and get your dedicated US warehouse address for online shopping shipped to Jamaica.',
    path: '/signup',
  },
  terms: {
    title: 'Terms & Conditions — Package Boss Shipping & Logistics',
    description:
      'Terms and conditions for Package Boss Shipping & Logistics freight forwarding and package delivery services.',
    path: '/terms',
  },
  privacy: {
    title: 'Privacy Policy — Package Boss',
    description:
      'How Package Boss collects, uses, and protects your personal information when you use our shipping and logistics platform.',
    path: '/privacy',
  },
  dataProtection: {
    title: 'Data Protection Policy — Package Boss',
    description:
      'Package Boss data protection principles and safeguards for customer and shipment information.',
    path: '/data-protection',
  },
  login: {
    title: 'Boss Member Login — Package Boss',
    description: 'Sign in to your Package Boss customer or staff account.',
    path: '/login',
    noindex: true,
  },
  forgotPassword: {
    title: 'Forgot Password — Package Boss',
    description: 'Reset your Package Boss account password.',
    path: '/forgot-password',
    noindex: true,
  },
  resetPassword: {
    title: 'Reset Password — Package Boss',
    description: 'Choose a new password for your Package Boss account.',
    path: '/reset-password',
    noindex: true,
  },
} satisfies Record<string, PageSeo>

export function absoluteUrl(path: string): string {
  if (path.startsWith('http')) return path
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${SITE_URL}${normalized}`
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_LEGAL_NAME,
    alternateName: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512.png`,
    telephone: COMPANY_PHONE_TEL,
    description: DEFAULT_DESCRIPTION,
    address: {
      '@type': 'PostalAddress',
      streetAddress: '2201 SW 59th Terrace',
      addressLocality: 'West Park',
      addressRegion: 'FL',
      postalCode: '33023',
      addressCountry: 'US',
    },
    areaServed: {
      '@type': 'Country',
      name: 'Jamaica',
    },
    knowsAbout: [
      'International freight forwarding',
      'US to Jamaica package shipping',
      'Fort Lauderdale warehouse',
    ],
  }
}
