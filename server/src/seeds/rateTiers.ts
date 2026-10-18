import { count } from 'drizzle-orm'
import { db } from '../db/index.js'
import { shippingRateTiers } from '../db/schema/index.js'
import { MAX_AUTO_RATE_LBS, REVISED_RATE_USD_BY_LBS } from '../data/revisedRateTable.js'

function buildRateTierSeed() {
  return Array.from({ length: MAX_AUTO_RATE_LBS }, (_, i) => {
    const lbs = i + 1
    return {
      label: lbs === 1 ? '1 lb' : `${lbs} lbs`,
      minW: lbs,
      maxW: lbs,
      flat: REVISED_RATE_USD_BY_LBS[lbs]!,
    }
  })
}

const RATE_TIER_SEED = buildRateTierSeed()

async function insertRateTiers() {
  for (let i = 0; i < RATE_TIER_SEED.length; i++) {
    const { label, minW, maxW, flat } = RATE_TIER_SEED[i]!
    await db.insert(shippingRateTiers).values({
      displayLabel: label,
      minWeightLbs: minW,
      maxWeightLbs: maxW,
      pricingType: 'flat',
      flatRateUsd: flat.toFixed(2),
      ratePerLbUsd: undefined,
      sortOrder: i + 1,
      isActive: true,
    })
  }
}

export async function seedRateTiers() {
  const [{ value: tierCount }] = await db.select({ value: count() }).from(shippingRateTiers)
  if (tierCount > 0) return
  await insertRateTiers()
}

export async function replaceRateTiers() {
  await db.delete(shippingRateTiers)
  await insertRateTiers()
}
