import { COMPANY_LEGAL_NAME } from './terms'
import { COMPANY_PHONE_DISPLAY, PRIVACY_EMAIL } from './legal'
import type { LegalSection } from './legal'

export const DATA_PROTECTION_SECTIONS: LegalSection[] = [
  {
    title: '1. Purpose & Scope',
    paragraphs: [
      `This Data Protection Policy describes how ${COMPANY_LEGAL_NAME} (“Package Boss”) implements data protection principles and safeguards personal information processed through our logistics platform.`,
      'It supplements our Privacy Policy and applies to all employees, contractors, clerks, administrators, and third-party processors who handle customer or operational data on our behalf.',
    ],
  },
  {
    title: '2. Regulatory Framework',
    paragraphs: [
      'Package Boss is committed to handling personal data responsibly and in accordance with applicable laws, including the Jamaica Data Protection Act, 2020 (where applicable to our processing activities), and relevant United States requirements for our Florida warehouse operations.',
      'Where international transfers occur, we apply appropriate safeguards as described in our Privacy Policy.',
    ],
  },
  {
    title: '3. Data Protection Principles',
    paragraphs: ['We adhere to the following principles when processing personal data:'],
    bullets: [
      'Lawfulness, fairness, and transparency — we process data for clear purposes explained to customers.',
      'Purpose limitation — data is collected for logistics, billing, customs, and account management, not unrelated marketing resale.',
      'Data minimization — we collect only information reasonably necessary to provide our services (TRN is optional).',
      'Accuracy — customers may update profile and contact details; staff are trained to correct errors when identified.',
      'Storage limitation — data is retained only as long as needed for operations and legal obligations.',
      'Integrity and confidentiality — access is restricted and systems are protected by technical and organizational measures.',
      'Accountability — we maintain records of processing activities and staff permissions relevant to data access.',
    ],
  },
  {
    title: '4. Categories of Data Subjects & Data',
    paragraphs: ['We process personal data relating to:'],
    bullets: [
      'Registered customers (account, contact, optional TRN, delivery addresses, authorized pickups).',
      'Shipment and billing data linked to customer accounts.',
      'Warehouse staff and administrators (employment or contractor contact details, system access logs).',
      'Authorized pickup persons designated by customers.',
      'Individuals associated with unidentified packages until ownership is resolved.',
    ],
  },
  {
    title: '5. Roles & Responsibilities',
    paragraphs: [
      'Package Boss acts as the data controller for customer account and shipment information processed through our platform.',
      'Administrators are responsible for overall compliance, staff onboarding, and responding to data subject requests.',
      'Clerks and warehouse staff may access customer data only as required by their assigned permissions (receive, billing, directory, status updates, activity log, etc.).',
      'Third-party processors (hosting, email delivery, cloud storage) process data under our instructions and must maintain appropriate security standards.',
    ],
  },
  {
    title: '6. Access Controls',
    paragraphs: [
      'Access to customer personal data within our platform is role-based. Customers access their own accounts via authenticated login. Clerks receive granular permissions configured by administrators. Customer Tax Registration Numbers (TRN) and sensitive billing details are limited to roles that require them for customs or payment processing.',
      'Staff accounts can be deactivated immediately when employment or contractor arrangements end. Invite-only clerk creation with mandatory password setup reduces unauthorized access.',
    ],
  },
  {
    title: '7. Technical & Organizational Measures',
    paragraphs: ['We implement measures including, where appropriate:'],
    bullets: [
      'HTTPS encryption for data in transit between browsers and our API.',
      'Hashed password storage (passwords are never stored in plain text).',
      'Database access restricted to application services with environment-based credentials.',
      'Audit logging of significant package and warehouse actions.',
      'Presigned, time-limited URLs for invoice and warehouse photo uploads.',
      'Separation of customer, clerk, and admin interfaces with route and API permission checks.',
      'Regular review of staff permissions and inactive accounts.',
    ],
  },
  {
    title: '8. Data Processors & Sub-Processors',
    paragraphs: [
      'We use trusted infrastructure and service providers for database hosting, email delivery, file storage, and website hosting. These providers may process personal data solely to deliver their service to us. We assess providers for security practices appropriate to the data involved.',
    ],
  },
  {
    title: '9. Data Subject Requests',
    paragraphs: [
      'Customers may submit requests to access, correct, or delete personal data by emailing info@packagebossja.com. We will respond within a reasonable timeframe and in accordance with applicable law.',
      'Deletion requests may be limited where we must retain records for customs, tax, accounting, dispute resolution, or legal compliance. We will explain any retention that applies.',
    ],
  },
  {
    title: '10. Personal Data Breaches',
    paragraphs: [
      'We maintain procedures to detect, investigate, and respond to suspected personal data breaches. Where a breach is likely to result in risk to individuals and notification is required by law, we will notify affected data subjects and relevant authorities without undue delay, in line with applicable requirements.',
      'Staff and contractors must report suspected data incidents to management immediately.',
    ],
  },
  {
    title: '11. Staff Training & Confidentiality',
    paragraphs: [
      'Personnel with access to customer data are expected to maintain confidentiality, use data only for authorized business purposes, and follow this policy and our Terms and Conditions. Unauthorized access, disclosure, or misuse of personal data may result in disciplinary action and termination of access.',
    ],
  },
  {
    title: '12. International Transfers',
    paragraphs: [
      'Customer data may be stored or processed in the United States while services are delivered in Jamaica. We ensure that cross-border transfers are conducted with appropriate safeguards and only for purposes described in our Privacy Policy.',
    ],
  },
  {
    title: '13. Policy Review',
    paragraphs: [
      'This Data Protection Policy is reviewed periodically and updated when our processing activities, systems, or legal requirements change. The effective date reflects the latest published version.',
    ],
  },
  {
    title: '14. Contact',
    paragraphs: [
      `Data protection enquiries for ${COMPANY_LEGAL_NAME} may be directed to ${PRIVACY_EMAIL} or ${COMPANY_PHONE_DISPLAY}.`,
      'See also our Privacy Policy for customer-facing information about collection, use, and rights.',
    ],
  },
]
