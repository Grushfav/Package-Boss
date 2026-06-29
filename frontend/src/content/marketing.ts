import { LocateFixed, Mail, MessageCircle, Truck, type LucideIcon } from 'lucide-react'

export const TAGLINE =
  'Leave it to the Boss — Your Ideal Transit Hub, Bringing Anything from Abroad Straight to Yaad.'

export const SHIPPING_FREQUENCY_BADGE = '3× weekly Fort Lauderdale → Jamaica'
export const SHIPPING_FREQUENCY_SHORT = '3 times per week'
export const SHIPPING_FREQUENCY_BLURB =
  'We ship from our Fort Lauderdale warehouse to Jamaica three times per week, so your packages spend less time waiting in Florida and more time on the way to yaad.'

export const ABOUT_PARAGRAPHS = [
  'Package Boss was created to provide clients with a smooth, reliable, and affordable shipping experience. Whether you\'re purchasing products from your favourite online stores or receiving packages from family and friends overseas, Package Boss serves as your trusted shipping partner, bridging the gap between the United States and Jamaica.',
  'At Package Boss, every package matters. We understand the importance of timely deliveries, transparent communication, and exceptional customer service. That\'s why we are committed to ensuring that your shipments are handled with care and delivered efficiently every step of the way.',
  'Through our dependable and convenient services — including three weekly departures from Fort Lauderdale — we make international shipping simple, secure, and hassle-free, giving you peace of mind from purchase to pick up.',
]

export interface ServiceItem {
  title: string
  description: string
  summary: string
  icon: LucideIcon
}

export const SERVICES: ServiceItem[] = [
  {
    title: 'Comprehensive Tracking',
    summary:
      'Live updates from our Fort Lauderdale warehouse until your package is ready in Jamaica.',
    description:
      'We keep you informed every step of the way, with timely updates on your package\'s journey from our Fort Lauderdale warehouse until it is ready in Jamaica. With three weekly shipments from Fort Lauderdale, your packages keep moving.',
    icon: LocateFixed,
  },
  {
    title: 'Email Notifications',
    summary:
      'Status, invoices, shipping info, and arrival notices — straight to your inbox.',
    description:
      'Regular email notifications keep you informed with package status, invoices, shipping information, arrival notices, and other important details related to your shipment.',
    icon: Mail,
  },
  {
    title: 'WhatsApp Updates',
    summary:
      'Opt in for quick package alerts alongside your dashboard and email.',
    description:
      'Opt in for convenient WhatsApp messages on package status and arrival — a quick way to stay in the loop alongside your dashboard and email updates.',
    icon: MessageCircle,
  },
  {
    title: 'Delivery & Pickup',
    summary:
      'Kingston & Portmore delivery, Thu–Sat pickup, and islandwide partners.',
    description:
      'Delivery within Kingston and Portmore on designated days for a fee. Collect from our drop-off points on Thursdays to Saturdays. Outside Kingston and Portmore, we use trusted partners including Knutsford Express and Zipmail for islandwide access.',
    icon: Truck,
  },
]

export const PICKUP_DAYS = 'Thursdays to Saturdays'
export const DELIVERY_AREAS = 'Kingston and Portmore'
