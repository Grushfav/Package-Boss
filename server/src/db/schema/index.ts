import {
  boolean,
  date,
  index,
  integer,
  json,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    firstName: varchar('first_name', { length: 80 }).notNull(),
    lastName: varchar('last_name', { length: 80 }).notNull(),
    contactNumber: varchar('contact_number', { length: 20 }).notNull(),
    parish: varchar('parish', { length: 50 }),
    trn: varchar('trn', { length: 11 }),
    shippingId: varchar('shipping_id', { length: 20 }).notNull().unique(),
    role: varchar('role', { length: 20 }).notNull().default('customer'),
    clerkPermissions: json('clerk_permissions').$type<string[] | null>(),
    isActive: boolean('is_active').notNull().default(true),
    mustSetPassword: boolean('must_set_password').notNull().default(false),
    tokenVersion: integer('token_version').notNull().default(0),
    termsAcceptedAt: timestamp('terms_accepted_at'),
    whatsappOptIn: boolean('whatsapp_opt_in').notNull().default(false),
    googleId: varchar('google_id', { length: 255 }).unique(),
    createdAt: timestamp('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    index('users_email_idx').on(t.email),
    index('users_trn_idx').on(t.trn),
    index('users_shipping_id_idx').on(t.shippingId),
    index('users_google_id_idx').on(t.googleId),
  ],
)

export const deliveryAddresses = pgTable(
  'delivery_addresses',
  {
    id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id),
    label: varchar('label', { length: 50 }).notNull(),
    recipientName: varchar('recipient_name', { length: 160 }),
    line1: varchar('line1', { length: 255 }).notNull(),
    line2: varchar('line2', { length: 255 }),
    community: varchar('community', { length: 100 }),
    parish: varchar('parish', { length: 50 }).notNull(),
    contactNumber: varchar('contact_number', { length: 20 }).notNull(),
    deliveryNotes: varchar('delivery_notes', { length: 500 }),
    isDefault: boolean('is_default').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('delivery_addresses_customer_id_idx').on(t.customerId)],
)

export const receiveBatches = pgTable(
  'receive_batches',
  {
    id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    batchCode: varchar('batch_code', { length: 20 }).notNull().unique(),
    reference: varchar('reference', { length: 100 }).notNull(),
    receiveDate: date('receive_date').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('open'),
    note: varchar('note', { length: 500 }),
    createdById: uuid('created_by_id').references(() => users.id),
    closedAt: timestamp('closed_at'),
    createdAt: timestamp('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    index('receive_batches_batch_code_idx').on(t.batchCode),
    index('receive_batches_status_idx').on(t.status),
  ],
)

export const shipments = pgTable(
  'shipments',
  {
    id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    reference: varchar('reference', { length: 100 }).notNull(),
    departureDate: date('departure_date').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('open'),
    note: varchar('note', { length: 500 }),
    createdById: uuid('created_by_id').references(() => users.id),
    departedAt: timestamp('departed_at'),
    createdAt: timestamp('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('shipments_status_idx').on(t.status)],
)

export const packages = pgTable(
  'packages',
  {
    id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    trackingNumber: varchar('tracking_number', { length: 30 }).notNull().unique(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id),
    carrierTracking: varchar('carrier_tracking', { length: 100 }),
    itemDescription: varchar('item_description', { length: 255 }),
    labelName: varchar('label_name', { length: 255 }),
    labelBossId: varchar('label_boss_id', { length: 20 }),
    shipper: varchar('shipper', { length: 30 }),
    actualWeightLbs: numeric('actual_weight_lbs', { precision: 8, scale: 2 }),
    billableWeightLbs: integer('billable_weight_lbs'),
    shippingCostUsd: numeric('shipping_cost_usd', { precision: 10, scale: 2 }),
    estimatedFreightJmd: numeric('estimated_freight_jmd', { precision: 12, scale: 2 }),
    dutiesJmd: numeric('duties_jmd', { precision: 12, scale: 2 }),
    handlingJmd: numeric('handling_jmd', { precision: 12, scale: 2 }),
    otherFeesJmd: numeric('other_fees_jmd', { precision: 12, scale: 2 }),
    totalDueJmd: numeric('total_due_jmd', { precision: 12, scale: 2 }),
    billingStatus: varchar('billing_status', { length: 20 }).notNull().default('pending'),
    invoiceStatus: varchar('invoice_status', { length: 20 }).notNull().default('pending'),
    invoiceObjectKey: varchar('invoice_object_key', { length: 500 }),
    declaredValueUsd: numeric('declared_value_usd', { precision: 10, scale: 2 }),
    invoiceRequestedAt: timestamp('invoice_requested_at'),
    invoiceRequestedVia: varchar('invoice_requested_via', { length: 20 }),
    invoiceRequestNote: varchar('invoice_request_note', { length: 500 }),
    invoiceReceivedAt: timestamp('invoice_received_at'),
    deliveryAddressId: uuid('delivery_address_id').references(() => deliveryAddresses.id),
    rateTierLabel: varchar('rate_tier_label', { length: 50 }),
    status: varchar('status', { length: 50 }).notNull().default('received'),
    receiveBatchId: uuid('receive_batch_id').references(() => receiveBatches.id),
    shipmentId: uuid('shipment_id').references(() => shipments.id),
    labelPrintedAt: timestamp('label_printed_at'),
    receivedAt: timestamp('received_at').notNull().$defaultFn(() => new Date()),
    createdAt: timestamp('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    index('packages_tracking_number_idx').on(t.trackingNumber),
    index('packages_receive_batch_id_idx').on(t.receiveBatchId),
    index('packages_shipment_id_idx').on(t.shipmentId),
  ],
)

export const packageEvents = pgTable('package_events', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  packageId: uuid('package_id')
    .notNull()
    .references(() => packages.id),
  status: varchar('status', { length: 50 }).notNull(),
  note: varchar('note', { length: 255 }),
  createdAt: timestamp('created_at').notNull().$defaultFn(() => new Date()),
})

export const packagePhotos = pgTable('package_photos', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  packageId: uuid('package_id')
    .notNull()
    .references(() => packages.id),
  r2ObjectKey: varchar('r2_object_key', { length: 500 }).notNull(),
  createdAt: timestamp('created_at').notNull().$defaultFn(() => new Date()),
})

export const preAlerts = pgTable(
  'pre_alerts',
  {
    id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id),
    carrierTracking: varchar('carrier_tracking', { length: 100 }).notNull(),
    merchant: varchar('merchant', { length: 100 }),
    description: varchar('description', { length: 255 }),
    declaredValueUsd: numeric('declared_value_usd', { precision: 10, scale: 2 }),
    invoiceObjectKey: varchar('invoice_object_key', { length: 500 }),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    packageId: uuid('package_id').references(() => packages.id),
    createdAt: timestamp('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    index('pre_alerts_customer_id_idx').on(t.customerId),
    index('pre_alerts_carrier_tracking_idx').on(t.carrierTracking),
  ],
)

export const deliveryRequests = pgTable(
  'delivery_requests',
  {
    id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id),
    deliveryAddressId: uuid('delivery_address_id')
      .notNull()
      .references(() => deliveryAddresses.id),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    deliveryFeeJmd: numeric('delivery_fee_jmd', { precision: 12, scale: 2 }).notNull(),
    notes: varchar('notes', { length: 500 }),
    requestedAt: timestamp('requested_at').notNull().$defaultFn(() => new Date()),
    completedAt: timestamp('completed_at'),
    completedById: uuid('completed_by_id').references(() => users.id),
    inProgressAt: timestamp('in_progress_at'),
    inProgressById: uuid('in_progress_by_id').references(() => users.id),
    cancelledAt: timestamp('cancelled_at'),
  },
  (t) => [
    index('delivery_requests_customer_id_idx').on(t.customerId),
    index('delivery_requests_status_idx').on(t.status),
  ],
)

export const deliveryRequestPackages = pgTable(
  'delivery_request_packages',
  {
    id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    deliveryRequestId: uuid('delivery_request_id')
      .notNull()
      .references(() => deliveryRequests.id, { onDelete: 'cascade' }),
    packageId: uuid('package_id')
      .notNull()
      .unique()
      .references(() => packages.id),
  },
  (t) => [index('delivery_request_packages_delivery_request_id_idx').on(t.deliveryRequestId)],
)

export const paymentCheckouts = pgTable(
  'payment_checkouts',
  {
    id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id),
    invoiceNumber: varchar('invoice_number', { length: 40 }).notNull().unique(),
    totalJmd: numeric('total_jmd', { precision: 12, scale: 2 }).notNull(),
    method: varchar('method', { length: 30 }).notNull(),
    reference: varchar('reference', { length: 100 }),
    notes: varchar('notes', { length: 500 }),
    recordedById: uuid('recorded_by_id').references(() => users.id),
    deliveryRequestId: uuid('delivery_request_id').references(() => deliveryRequests.id),
    deliveryFeeJmd: numeric('delivery_fee_jmd', { precision: 12, scale: 2 }),
    processingFeeJmd: numeric('processing_fee_jmd', { precision: 12, scale: 2 }),
    recordedAt: timestamp('recorded_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('payment_checkouts_invoice_number_idx').on(t.invoiceNumber)],
)

export const paymentCheckoutItems = pgTable(
  'payment_checkout_items',
  {
    id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    checkoutId: uuid('checkout_id')
      .notNull()
      .references(() => paymentCheckouts.id, { onDelete: 'cascade' }),
    packageId: uuid('package_id')
      .notNull()
      .unique()
      .references(() => packages.id),
    amountJmd: numeric('amount_jmd', { precision: 12, scale: 2 }).notNull(),
  },
  (t) => [index('payment_checkout_items_checkout_id_idx').on(t.checkoutId)],
)

export const bankTransferProofs = pgTable(
  'bank_transfer_proofs',
  {
    id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id),
    proofObjectKey: varchar('proof_object_key', { length: 500 }).notNull(),
    transferReference: varchar('transfer_reference', { length: 100 }),
    senderBank: varchar('sender_bank', { length: 80 }),
    amountJmd: numeric('amount_jmd', { precision: 12, scale: 2 }),
    includeDeliveryFee: boolean('include_delivery_fee').notNull().default(false),
    notes: varchar('notes', { length: 500 }),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    submittedAt: timestamp('submitted_at').notNull().$defaultFn(() => new Date()),
    reviewedAt: timestamp('reviewed_at'),
    reviewedById: uuid('reviewed_by_id').references(() => users.id),
  },
  (t) => [
    index('bank_transfer_proofs_customer_id_idx').on(t.customerId),
    index('bank_transfer_proofs_status_idx').on(t.status),
  ],
)

export const bankTransferProofPackages = pgTable(
  'bank_transfer_proof_packages',
  {
    id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    proofId: uuid('proof_id')
      .notNull()
      .references(() => bankTransferProofs.id, { onDelete: 'cascade' }),
    packageId: uuid('package_id')
      .notNull()
      .references(() => packages.id),
  },
  (t) => [
    index('bank_transfer_proof_packages_proof_id_idx').on(t.proofId),
    index('bank_transfer_proof_packages_package_id_idx').on(t.packageId),
  ],
)

export const authorizedPickupPersons = pgTable(
  'authorized_pickup_persons',
  {
    id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id),
    fullName: varchar('full_name', { length: 160 }).notNull(),
    relationship: varchar('relationship', { length: 30 }).notNull(),
    contactNumber: varchar('contact_number', { length: 20 }).notNull(),
    idType: varchar('id_type', { length: 30 }).notNull(),
    idLastFour: varchar('id_last_four', { length: 4 }),
    notes: varchar('notes', { length: 500 }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('authorized_pickup_persons_customer_id_idx').on(t.customerId)],
)

export const announcements = pgTable('announcements', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: varchar('title', { length: 120 }).notNull(),
  body: text('body').notNull(),
  severity: varchar('severity', { length: 20 }).notNull().default('info'),
  audience: varchar('audience', { length: 20 }).notNull().default('customers'),
  displayAs: varchar('display_as', { length: 20 }).notNull().default('banner'),
  startsAt: timestamp('starts_at').notNull().$defaultFn(() => new Date()),
  endsAt: timestamp('ends_at'),
  isActive: boolean('is_active').notNull().default(true),
  dismissible: boolean('dismissible').notNull().default(true),
  broadcastAt: timestamp('broadcast_at'),
  createdById: uuid('created_by_id').references(() => users.id),
  createdAt: timestamp('created_at').notNull().$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at').notNull().$defaultFn(() => new Date()),
})

export const announcementDismissals = pgTable(
  'announcement_dismissals',
  {
    id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    announcementId: uuid('announcement_id')
      .notNull()
      .references(() => announcements.id, { onDelete: 'cascade' }),
    dismissedAt: timestamp('dismissed_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    unique('uq_announcement_dismissal').on(t.userId, t.announcementId),
    index('announcement_dismissals_user_id_idx').on(t.userId),
  ],
)

export const announcementReads = pgTable(
  'announcement_reads',
  {
    id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    announcementId: uuid('announcement_id')
      .notNull()
      .references(() => announcements.id, { onDelete: 'cascade' }),
    readAt: timestamp('read_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    unique('uq_announcement_read').on(t.userId, t.announcementId),
    index('announcement_reads_user_id_idx').on(t.userId),
  ],
)

export const broadcastJobs = pgTable('broadcast_jobs', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  announcementId: uuid('announcement_id')
    .notNull()
    .references(() => announcements.id, { onDelete: 'cascade' }),
  channels: json('channels').$type<string[]>().notNull().default([]),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  sentCount: integer('sent_count').notNull().default(0),
  failedCount: integer('failed_count').notNull().default(0),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().$defaultFn(() => new Date()),
})

export const appSettings = pgTable('app_settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').notNull().$defaultFn(() => new Date()),
  updatedById: uuid('updated_by_id').references(() => users.id),
})

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    actorId: uuid('actor_id').references(() => users.id),
    actorName: varchar('actor_name', { length: 160 }),
    actorRole: varchar('actor_role', { length: 20 }).notNull(),
    action: varchar('action', { length: 50 }).notNull(),
    entityType: varchar('entity_type', { length: 30 }).notNull().default('package'),
    entityId: varchar('entity_id', { length: 36 }),
    summary: varchar('summary', { length: 500 }).notNull(),
    metadataJson: json('metadata_json'),
    createdAt: timestamp('created_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    index('audit_logs_actor_id_idx').on(t.actorId),
    index('audit_logs_action_idx').on(t.action),
    index('audit_logs_entity_id_idx').on(t.entityId),
    index('audit_logs_created_at_idx').on(t.createdAt),
  ],
)

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    tokenHash: varchar('token_hash', { length: 64 }).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('password_reset_tokens_user_id_idx').on(t.userId)],
)

export const logisticsJobs = pgTable(
  'logistics_jobs',
  {
    id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    reference: varchar('reference', { length: 20 }).notNull().unique(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id),
    pickupAddressId: uuid('pickup_address_id')
      .notNull()
      .references(() => deliveryAddresses.id),
    dropoffAddressId: uuid('dropoff_address_id')
      .notNull()
      .references(() => deliveryAddresses.id),
    itemDescription: varchar('item_description', { length: 500 }).notNull(),
    vehicleType: varchar('vehicle_type', { length: 20 }),
    deliverySpeed: varchar('delivery_speed', { length: 20 }),
    weightLbs: numeric('weight_lbs', { precision: 8, scale: 2 }),
    notes: varchar('notes', { length: 500 }),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    quotedFeeJmd: numeric('quoted_fee_jmd', { precision: 12, scale: 2 }),
    feePendingQuote: boolean('fee_pending_quote').notNull().default(false),
    requestedAt: timestamp('requested_at').notNull().$defaultFn(() => new Date()),
    inProgressAt: timestamp('in_progress_at'),
    inProgressById: uuid('in_progress_by_id').references(() => users.id),
    pickedUpAt: timestamp('picked_up_at'),
    pickedUpById: uuid('picked_up_by_id').references(() => users.id),
    inTransitAt: timestamp('in_transit_at'),
    inTransitById: uuid('in_transit_by_id').references(() => users.id),
    completedAt: timestamp('completed_at'),
    completedById: uuid('completed_by_id').references(() => users.id),
    driverName: varchar('driver_name', { length: 160 }),
    driverContactNumber: varchar('driver_contact_number', { length: 20 }),
    driverConfirmedAt: timestamp('driver_confirmed_at'),
    driverConfirmedById: uuid('driver_confirmed_by_id').references(() => users.id),
    paymentMethod: varchar('payment_method', { length: 20 }).notNull().default('cash'),
    assignedClerkId: uuid('assigned_clerk_id').references(() => users.id),
    assignedAt: timestamp('assigned_at'),
    assignedById: uuid('assigned_by_id').references(() => users.id),
    rejectedAt: timestamp('rejected_at'),
    rejectedById: uuid('rejected_by_id').references(() => users.id),
    rejectionReason: varchar('rejection_reason', { length: 500 }),
    customerReceiptConfirmedAt: timestamp('customer_receipt_confirmed_at'),
    cancelledAt: timestamp('cancelled_at'),
  },
  (t) => [
    index('logistics_jobs_reference_idx').on(t.reference),
    index('logistics_jobs_status_idx').on(t.status),
    index('logistics_jobs_customer_id_idx').on(t.customerId),
  ],
)

export const shippingRateTiers = pgTable('shipping_rate_tiers', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  displayLabel: varchar('display_label', { length: 50 }).notNull(),
  minWeightLbs: integer('min_weight_lbs').notNull(),
  maxWeightLbs: integer('max_weight_lbs').notNull(),
  pricingType: varchar('pricing_type', { length: 20 }).notNull(),
  flatRateUsd: numeric('flat_rate_usd', { precision: 10, scale: 2 }),
  ratePerLbUsd: numeric('rate_per_lb_usd', { precision: 10, scale: 2 }),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
})

export type UserRow = typeof users.$inferSelect
