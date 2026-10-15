import { CLAIMS_EMAIL, COMPANY_LEGAL_NAME } from './terms'
import type { LegalSection } from './legal'

/** Public support inbox for customer data deletion requests (Meta / Google instructions URL). */
export const DATA_DELETION_EMAIL = CLAIMS_EMAIL

export const DATA_DELETION_MAILTO = `mailto:${DATA_DELETION_EMAIL}?subject=${encodeURIComponent('Data deletion request')}`

export const DATA_DELETION_SECTIONS: LegalSection[] = [
  {
    title: '1. How to request deletion',
    paragraphs: [
      `To request deletion of your ${COMPANY_LEGAL_NAME} (“Package Boss”) account and associated personal data, email ${DATA_DELETION_EMAIL} from the email address registered on your account.`,
      'We will verify your identity before processing the request.',
    ],
  },
  {
    title: '2. What to include in your email',
    paragraphs: ['Please include:'],
    bullets: [
      'Subject line: Data deletion request',
      'Your full name as shown on your Package Boss account',
      'Your BOSS shipping ID (if you have one)',
      'The email address registered on your account',
      'Optional: whether you signed up with email, Google, or Facebook',
    ],
  },
  {
    title: '3. What happens next',
    paragraphs: [
      'After we confirm your identity, we will delete or anonymize personal information associated with your account where practicable.',
      'We may retain certain shipment, customs, tax, accounting, or dispute-related records where required by law or necessary for legitimate business operations. Where retention applies, we will explain what remains and why.',
      'You will receive a confirmation email when your request has been received and when processing is complete.',
    ],
  },
  {
    title: '4. Social sign-in (Google / Facebook)',
    paragraphs: [
      'If you signed in with Google or Facebook, emailing us still starts your Package Boss deletion request.',
      'You may also disconnect Package Boss from your Google or Facebook account settings. When you remove our Facebook app, Meta notifies us automatically and we unlink your Facebook identity from Package Boss.',
      'Removing the app connection does not by itself delete Package Boss warehouse or billing records required for customs, tax, or accounting; email us as described above to request full account data removal.',
    ],
  },
  {
    title: '5. Contact',
    paragraphs: [
      `Data deletion requests: ${DATA_DELETION_EMAIL}`,
      'For general privacy questions, see our Privacy Policy and Data Protection Policy.',
    ],
  },
]
