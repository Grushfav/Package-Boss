export const COMPANY_LEGAL_NAME = 'Package Boss Shipping & Logistics'
export const TERMS_EFFECTIVE_DATE = 'June 21, 2026'
export const CLAIMS_EMAIL = 'support@packageboss.com'

export interface TermsSection {
  title: string
  paragraphs?: string[]
  bullets?: string[]
}

export const TERMS_SECTIONS: TermsSection[] = [
  {
    title: '1. Acceptance of Terms',
    paragraphs: [
      `By engaging the services of ${COMPANY_LEGAL_NAME}, the customer agrees to be bound by these Terms and Conditions. By proceeding with our services, the customer confirms that they have read, understood, and accepted these Terms in full. Continued use of our services constitutes ongoing acceptance.`,
    ],
  },
  {
    title: '2. Scope of Services',
    paragraphs: [
      `${COMPANY_LEGAL_NAME} provides international air freight and package shipping services from the United States to Jamaica, including but not limited to package receiving and consolidation, air freight transportation, customs processing and clearance assistance, and local package collection and delivery services.`,
      'We act as a freight forwarder and logistics provider and may engage third-party carriers, airlines, customs brokers, and delivery agents to facilitate shipment services.',
      `${COMPANY_LEGAL_NAME} reserves the right to modify, suspend, or discontinue any service at its discretion without prior notice.`,
    ],
  },
  {
    title: '3. Responsibilities, Risk & Liability',
    paragraphs: [
      'The customer agrees to provide accurate personal information (including name, contact number, email address, and TRN), accurate shipment information, properly packaged and labeled goods, and all documentation required for shipment and clearance. The customer must comply with applicable laws and pay all charges, duties, taxes, and fees.',
      'The customer shall be liable for any losses, fines, penalties, or expenses resulting from inaccurate or incomplete information. All shipments are transported at the customer’s own risk.',
      `${COMPANY_LEGAL_NAME} is not responsible for vendor errors, incorrect customer information, packages lost before reaching our warehouse, or delays and damages caused by third parties.`,
      `${COMPANY_LEGAL_NAME} assumes zero / limited liability for loss, damage, delay, or errors related to shipments. Responsibility, where applicable, begins when a package reaches our warehouse or at pickup, and ends once handed to third-party carriers, customs authorities, or delivery partners.`,
    ],
  },
  {
    title: '4. Packaging & Fragile Items',
    paragraphs: [
      `${COMPANY_LEGAL_NAME} is not responsible for damage caused by improper or insufficient packaging by vendors, senders, or customers.`,
      'Fragile items, including electronics, glass, liquids, cosmetics, or breakable goods, are shipped at the owner’s risk, regardless of packaging method.',
    ],
  },
  {
    title: '5. Prohibited and Restricted Items',
    paragraphs: [
      'Customers are responsible for ensuring all items comply with local and international laws. Prohibited items include, but are not limited to: illegal drugs, firearms and ammunition, explosives and hazardous materials, counterfeit goods, pornographic materials, live animals, perishable goods, cash or negotiable instruments, and any items prohibited by law.',
      'Any prohibited item may be confiscated, disposed of, or surrendered to authorities without refund. Package Boss Shipping & Logistics assumes no liability for seizures, fines, or penalties.',
    ],
  },
  {
    title: '6. Shipping Charges',
    paragraphs: [
      'Shipping charges are based on the actual or volumetric weight of the shipment, whichever is greater.',
      'Published rates apply up to 50 lbs billable weight using our tier rate table (JMD displayed at 160 JMD = 1 USD). Packages over 50 lbs require a custom quote.',
      'Charges may include freight, customs duties and taxes, storage, special handling, insurance, delivery fees, and processing fees.',
      'All fees must be paid in full before packages are released or delivered. Package Boss Shipping & Logistics reserves the right to revise rates without prior notice.',
    ],
  },
  {
    title: '7. Shipping Times',
    paragraphs: [
      'Estimated transit times are provided as a guide only. Delivery schedules may be affected by weather, airline schedules, customs inspections, government actions, security procedures, force majeure, or other circumstances beyond the Company’s control.',
      `${COMPANY_LEGAL_NAME} does not guarantee specific delivery dates and shall not be liable for losses arising from shipment delays.`,
    ],
  },
  {
    title: '8. Inspection of Shipments',
    paragraphs: [
      `${COMPANY_LEGAL_NAME} reserves the right to inspect, open, scan, or examine any shipment when required by law, security regulations, customs authorities, or operational requirements.`,
    ],
  },
  {
    title: '9. Collection of Packages',
    paragraphs: [
      'Customers will be notified when packages are available for collection. Customers must present valid government-issued identification, verify package details before leaving, and pay all applicable charges prior to release.',
      'The Company may refuse release where identification requirements are not satisfied.',
    ],
  },
  {
    title: '10. Delivery Services',
    paragraphs: [
      'Where delivery services are offered, packages will be delivered to the address on file subject to applicable delivery fees and service availability.',
      'Customers must present valid government-issued identification upon delivery and pay all outstanding charges before release. Delivery times are estimates only and subject to Section 7.',
    ],
  },
  {
    title: '11. Storage & Uncollected Packages',
    paragraphs: [
      'Packages not collected within fourteen (14) days of notification may incur storage fees of fifty dollars ($50) per day.',
      'Packages uncollected after thirty (30) days may be auctioned, donated, or disposed of to recover storage and administrative costs. Customers remain responsible for all outstanding charges.',
    ],
  },
  {
    title: '12. Payment Terms',
    paragraphs: [
      'Accepted payment methods include bank transfer and cash. All payments must be settled in full before processing. Payments are non-refundable once service or shipment processing begins.',
    ],
  },
  {
    title: '13. Refund, Return and Exchange Policy',
    paragraphs: [
      'All services rendered by the Company are provided on a non-refundable basis, including parcels received, warehouse storage, freight forwarding, and delivery.',
      'We are not responsible for merchant fulfilment errors. Customers must arrange returns, refunds, or exchanges directly with merchants.',
      'Exchanges are not facilitated. We will facilitate return delivery of items while goods remain at the User’s U.S. delivery address, subject to applicable return charges. Return labels must be provided or return charges paid before goods can be returned to the merchant.',
    ],
  },
  {
    title: '14. Customs, Duties & Fees',
    paragraphs: [
      'All shipments entering Jamaica are subject to inspection and assessment by the Jamaica Customs Agency. Customs duties, taxes, and fees are determined solely by JCA; we have no control over assessments.',
      'Customs Duties, GCT, and other government-imposed fees are the sole responsibility of the customer, who must provide accurate declarations and comply with import regulations.',
      `${COMPANY_LEGAL_NAME} assumes no liability for customs delays, inspections, seizures, or penalties. For more information visit https://www.jacustoms.gov.jm/service/duties-taxes-0`,
    ],
  },
  {
    title: '15. Claims & Complaints',
    paragraphs: [
      `Customers must inspect shipments immediately upon receipt. Claims for loss or damage must be submitted in writing via email to ${CLAIMS_EMAIL} within twenty-four (24) hours of collection, or within fourteen (14) days after notification for a missing package.`,
      'Claims must include supporting documentation (invoices, photographs, proof of value). Failure to submit within the specified period may result in denial. WhatsApp messages do not constitute official claims.',
    ],
  },
  {
    title: '16. Limitation of Liability',
    paragraphs: [
      'The Company’s liability is limited to the lesser of the actual value of the goods or JMD $5,000 per shipment.',
      'We are not liable for third-party carrier loss or damage, customs delays, inadequate packaging, inaccurate shipping information, force majeure, airline delays, or manufacturer defects.',
      'Compensation for lost or damaged goods is available only if additional insurance is purchased, subject to terms.',
    ],
  },
  {
    title: '17. Force Majeure',
    paragraphs: [
      'The Company shall not be liable for failure or delay caused by events beyond its reasonable control, including natural disasters, strikes, pandemics, war, terrorism, civil unrest, government restrictions, or transportation disruptions.',
    ],
  },
  {
    title: '18. Privacy and Confidentiality',
    paragraphs: [
      'Customer information is used solely for operational, regulatory, and administrative purposes and will not be disclosed except as required by law or necessary to provide services.',
    ],
  },
  {
    title: '19. Governing Law',
    paragraphs: [
      'These Terms are governed by the laws of Jamaica. Disputes are subject to the exclusive jurisdiction of the courts of Jamaica.',
    ],
  },
  {
    title: '20. Amendments',
    paragraphs: [
      'The Company may amend these Terms at any time. Updated terms become effective upon publication or notification to the customer.',
    ],
  },
]
