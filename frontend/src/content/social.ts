import { COMPANY_PHONE_TEL } from './legal'

/** Social profile URLs — leave empty until ready; icons show as placeholders. */
export const SOCIAL_URLS = {
  instagram: 'https://www.instagram.com/packagebossja/',
  whatsapp: `https://wa.me/${COMPANY_PHONE_TEL.replace(/\D/g, '')}`,
  tiktok: '',
} as const
