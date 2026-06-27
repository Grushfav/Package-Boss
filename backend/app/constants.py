JAMAICA_PARISHES = [
    "Kingston",
    "St. Andrew",
    "St. Thomas",
    "Portland",
    "St. Mary",
    "St. Ann",
    "Trelawny",
    "St. James",
    "Hanover",
    "Westmoreland",
    "St. Elizabeth",
    "Manchester",
    "Clarendon",
    "St. Catherine",
]

UNIDENTIFIED_HOLDER_EMAIL = "unidentified@package-boss.internal"
UNIDENTIFIED_HOLDER_SHIPPING_ID = "BOSS-00000"

PACKAGE_STATUSES = [
    "unidentified",
    "awaiting_receipt",
    "received",
    "in_transit",
    "customs",
    "ready_for_pickup",
    "delivered",
]

# Shipment statuses clerks can set (excludes unidentified queue state)
UPDATABLE_STATUSES = [s for s in PACKAGE_STATUSES if s != "unidentified"]

STATUS_LABELS = {
    "unidentified": "Unidentified — Awaiting Owner",
    "awaiting_receipt": "Awaiting Receipt",
    "received": "Received — Fort Lauderdale",
    "in_transit": "In Transit",
    "customs": "Customs",
    "ready_for_pickup": "Ready for Pickup / Delivery",
    "delivered": "Delivered",
}

# Customer-facing bill amounts only after release from customs
CUSTOMER_BILL_VISIBLE_STATUSES = ("ready_for_pickup", "delivered")
PAYMENT_ELIGIBLE_STATUS = "ready_for_pickup"

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_INVOICE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
}
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
MAX_INVOICE_SIZE_BYTES = 10 * 1024 * 1024

PRE_ALERT_STATUSES = ["pending", "matched", "received", "cancelled"]

PRE_ALERT_STATUS_LABELS = {
    "pending": "Awaiting Receipt",
    "matched": "Matched",
    "received": "Received",
    "cancelled": "Cancelled",
}

USER_ROLES = ["customer", "clerk", "admin"]

ROLE_LABELS = {
    "customer": "Customer",
    "clerk": "Clerk",
    "admin": "Admin",
}

WAREHOUSE_ROLES = ("clerk", "admin")
ADMIN_ROLES = ("admin",)

SHIPPERS = [
    {"code": "usps", "label": "USPS"},
    {"code": "ups", "label": "UPS"},
    {"code": "fedex", "label": "FedEx"},
    {"code": "dhl", "label": "DHL"},
    {"code": "amazon", "label": "Amazon"},
    {"code": "other", "label": "Other"},
]

SHIPPER_CODES = {s["code"] for s in SHIPPERS}
SHIPPER_LABELS = {s["code"]: s["label"] for s in SHIPPERS}

# Kingston & Portmore delivery area
DELIVERY_PARISHES = ["Kingston", "St. Andrew", "St. Catherine"]
MAX_DELIVERY_ADDRESSES = 4

MAX_AUTHORIZED_PICKUPS = 5

PICKUP_RELATIONSHIPS = ["spouse", "family", "friend", "colleague", "other"]

PICKUP_RELATIONSHIP_LABELS = {
    "spouse": "Spouse",
    "family": "Family member",
    "friend": "Friend",
    "colleague": "Colleague",
    "other": "Other",
}

PICKUP_ID_TYPES = ["drivers_license", "passport", "national_id", "voter_id"]

PICKUP_ID_TYPE_LABELS = {
    "drivers_license": "Driver's licence",
    "passport": "Passport",
    "national_id": "National ID",
    "voter_id": "Voter ID",
}

INVOICE_STATUSES = ["not_required", "pending", "requested", "received"]
INVOICE_STATUS_LABELS = {
    "not_required": "Not Required",
    "pending": "Awaiting Invoice",
    "requested": "Invoice Requested",
    "received": "Invoice Received",
}

BILLING_CURRENCY = "JMD"
BILLING_CURRENCY_SYMBOL = "J$"

BILLING_STATUSES = ["pending", "ready", "paid"]
BILLING_STATUS_LABELS = {
    "pending": "Bill Pending",
    "ready": "Amount Due",
    "paid": "Paid",
}

PAYMENT_METHODS = ["cash", "card", "bank_transfer"]
PAYMENT_METHOD_LABELS = {
    "cash": "Cash",
    "card": "Card",
    "bank_transfer": "Bank Transfer",
}

INVOICE_REQUEST_CHANNELS = ["email", "whatsapp", "both"]

# Clerk granular permissions (admin assigns; defaults on create)
CLERK_PERMISSIONS = [
    "receive",
    "activity",
    "directory",
    "status_transit",
    "status_customs",
    "status_pickup",
    "billing",
    "invoice_request",
]

CLERK_PERMISSION_LABELS = {
    "receive": "Receive packages",
    "activity": "Activity log",
    "directory": "Customer directory",
    "status_transit": "Status: received → in transit (Florida)",
    "status_customs": "Status: customs updates",
    "status_pickup": "Status: ready for pickup / delivered",
    "billing": "Billing & payments",
    "invoice_request": "Request customer invoices",
}

DEFAULT_CLERK_PERMISSIONS = ["receive", "activity"]

# Allowed status transitions per permission (admin bypasses)
STATUS_TRANSITIONS_BY_PERMISSION = {
    "status_transit": {("received", "in_transit")},
    "status_customs": {
        ("in_transit", "customs"),
        ("customs", "in_transit"),
        ("received", "customs"),
    },
    "status_pickup": {
        ("customs", "ready_for_pickup"),
        ("ready_for_pickup", "delivered"),
        ("in_transit", "ready_for_pickup"),
    },
}

INVITE_TOKEN_TTL_SECONDS = 86400  # 24 hours
