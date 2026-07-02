import { COMPANY_LEGAL_NAME } from './terms'
import type { LegalSection } from './legal'

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: '1. Introduction',
    paragraphs: [
      `${COMPANY_LEGAL_NAME} (“Package Boss”, “we”, “us”, or “our”) operates the Package Boss website, customer portal, and warehouse logistics platform. This Privacy Policy explains how we collect, use, store, share, and protect personal information when you use our services.`,
      'By creating an account, shipping packages through us, or using our website, you acknowledge that you have read this Privacy Policy. If you do not agree, please do not use our services.',
    ],
  },
  {
    title: '2. Who This Policy Applies To',
    paragraphs: [
      'This policy applies to customers who ship packages from our Fort Lauderdale warehouse to Jamaica, visitors to our public website, and individuals whose information is provided to us for delivery, pickup authorization, or customs processing.',
    ],
  },
  {
    title: '3. Information We Collect',
    paragraphs: ['We may collect the following categories of personal information:'],
    bullets: [
      'Identity and account data: name, email address, password (stored hashed), BOSS shipping ID, and optional Tax Registration Number (TRN).',
      'Contact data: phone number (including international numbers), parish, and Jamaica delivery addresses.',
      'Shipment data: carrier tracking numbers, package descriptions, weights, photos taken at our warehouse, invoice documents, declared values, and shipment status history.',
      'Billing and payment data: freight charges, duties, handling fees, payment records, and checkout receipts in Jamaican dollars (JMD).',
      'Authorized pickup persons: names, contact numbers, and ID types for people you authorize to collect packages on your behalf.',
      'Communications: emails we send (welcome, status updates, password reset, billing), and WhatsApp messages if you opt in.',
      'Technical data: browser type, device information, IP address, and usage of our website and progressive web app (PWA).',
      'Pre-alerts: advance shipment notices you submit before packages arrive at our warehouse.',
    ],
  },
  {
    title: '4. How We Use Your Information',
    paragraphs: ['We use personal information for legitimate business purposes, including:'],
    bullets: [
      'Creating and managing your customer account and BOSS shipping address.',
      'Receiving, processing, tracking, and delivering your packages.',
      'Calculating shipping rates, preparing bills, and collecting payment.',
      'Assisting with Jamaica customs clearance and regulatory compliance.',
      'Sending service notifications, billing updates, and account-related emails.',
      'Operating warehouse tools used by authorized staff (receive, status updates, billing).',
      'Preventing fraud, resolving disputes, and enforcing our Terms and Conditions.',
      'Improving our platform, troubleshooting issues, and maintaining security.',
    ],
  },
  {
    title: '5. Legal Basis for Processing',
    paragraphs: [
      'We process personal information where necessary to perform our contract with you (providing freight-forwarding and logistics services), to comply with legal obligations (including customs and tax regulations in Jamaica and the United States), and where we have a legitimate interest in operating our business securely and efficiently.',
      'Where required, we rely on your consent—for example, when you opt in to WhatsApp notifications or accept our Terms and Conditions at registration.',
    ],
  },
  {
    title: '6. How We Share Information',
    paragraphs: [
      'We do not sell your personal information. We may share information only as needed to provide our services or as required by law:',
    ],
    bullets: [
      'Carriers, airlines, and delivery partners involved in transporting your packages.',
      'Jamaica Customs and other government authorities when required for clearance, duties, or legal compliance.',
      'Payment processors and financial institutions when you pay for services.',
      'Technology providers that host our database, send email, store invoice photos, or operate our website infrastructure (including cloud storage and content delivery services).',
      'Authorized warehouse staff and administrators who require access to perform their duties under role-based permissions.',
      'Law enforcement, regulators, or courts when we are legally compelled to disclose information.',
    ],
  },
  {
    title: '7. International Data Transfers',
    paragraphs: [
      'Package Boss operates a United States warehouse and serves customers in Jamaica. Your information may be stored on servers in the United States or other countries where our service providers operate. When information is transferred internationally, we take reasonable steps to ensure it remains protected in line with this policy and applicable law.',
    ],
  },
  {
    title: '8. Cookies, Local Storage & Similar Technologies',
    paragraphs: [
      'Our website uses browser local storage to keep you signed in (JWT access token) and to cache your BOSS shipping address for offline access in our progressive web app. We do not use third-party advertising cookies.',
      'You can clear site data through your browser settings, but doing so will sign you out and remove cached offline content.',
    ],
  },
  {
    title: '9. Data Retention',
    paragraphs: [
      'We retain account and shipment records for as long as your account is active and as needed to fulfill legal, tax, customs, and accounting obligations. Package photos, audit logs, and billing records may be kept for a reasonable period after delivery to resolve disputes or comply with regulations.',
      'When information is no longer required, we delete or anonymize it where practicable.',
    ],
  },
  {
    title: '10. Security',
    paragraphs: [
      'We implement administrative, technical, and physical safeguards appropriate to the nature of the data we hold, including access controls for staff, encrypted connections (HTTPS), and hashed passwords. No method of transmission or storage is completely secure; we cannot guarantee absolute security.',
    ],
  },
  {
    title: '11. Your Rights & Choices',
    paragraphs: [
      'Depending on applicable law, you may have the right to:',
      'To exercise these rights, contact us using the details below. We may need to verify your identity before responding.',
    ],
    bullets: [
      'Access the personal information we hold about you.',
      'Correct inaccurate account or contact details through your profile or by contacting us.',
      'Request deletion of your account, subject to legal and operational retention requirements.',
      'Withdraw consent for optional communications such as WhatsApp notifications.',
      'Object to or restrict certain processing where the law provides such rights.',
    ],
  },
  {
    title: '12. Children',
    paragraphs: [
      'Our services are not directed to individuals under 18 years of age. We do not knowingly collect personal information from children. If you believe a child has provided us information, please contact us so we can delete it.',
    ],
  },
  {
    title: '13. Third-Party Links',
    paragraphs: [
      'Our website may link to external sites (for example, carrier tracking or Jamaica Customs resources). We are not responsible for the privacy practices of those third parties.',
    ],
  },
  {
    title: '14. Changes to This Policy',
    paragraphs: [
      'We may update this Privacy Policy from time to time. The effective date at the top of this page will change when we publish revisions. Material changes may also be communicated by email or a notice on our website. Continued use of our services after an update constitutes acceptance of the revised policy.',
    ],
  },
  {
    title: '15. Contact Us',
    paragraphs: [
      `For privacy questions, requests, or complaints, contact ${COMPANY_LEGAL_NAME} at info@packagebossja.com.`,
      'For data protection matters specifically, you may also refer to our Data Protection Policy.',
    ],
  },
]
