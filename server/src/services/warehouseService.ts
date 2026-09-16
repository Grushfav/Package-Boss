import { config } from '../config.js'

export function getWarehouseConfig() {
  return {
    line1: config.warehouseLine1,
    city: config.warehouseCity,
    state: config.warehouseState,
    zip: config.warehouseZip,
    country: config.warehouseCountry,
  }
}

export function buildShippingAddress(shippingId: string) {
  const warehouse = getWarehouseConfig()
  const formatted = `${warehouse.line1}\n${shippingId}\n${warehouse.city}, ${warehouse.state} ${warehouse.zip}\nUnited States`
  return {
    ...warehouse,
    line2: shippingId,
    formatted,
  }
}
