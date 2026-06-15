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
    "received_miami",
    "processing",
    "in_transit",
    "arrived_kingston",
    "out_for_delivery",
    "delivered",
]

# Shipment statuses clerks can set (excludes unidentified queue state)
UPDATABLE_STATUSES = [s for s in PACKAGE_STATUSES if s != "unidentified"]

STATUS_LABELS = {
    "unidentified": "Unidentified — Awaiting Owner",
    "awaiting_receipt": "Awaiting Receipt",
    "received_miami": "Received in Miami",
    "processing": "Processing",
    "in_transit": "In Transit to Kingston",
    "arrived_kingston": "Arrived in Kingston",
    "out_for_delivery": "Out for Delivery",
    "delivered": "Delivered",
}

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
