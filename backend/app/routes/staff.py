from flask import Blueprint, jsonify, request
from sqlalchemy import or_

from app.constants import SHIPPER_CODES, SHIPPERS, STATUS_LABELS, UPDATABLE_STATUSES
from app.models.package import Package
from app.models.user import User
from app.services.audit_service import (
    ACTION_PACKAGE_ASSIGNED,
    ACTION_PACKAGE_BILLING_UPDATED,
    ACTION_PACKAGE_INVOICE_REQUESTED,
    ACTION_PACKAGE_RECEIVED,
    ACTION_PACKAGE_RECEIVED_UNIDENTIFIED,
    ACTION_PACKAGE_STATUS_UPDATED,
    log_package_action,
)
from app.services.billing_service import (
    assign_delivery_address,
    request_package_invoice,
    update_package_billing,
)
from app.services.delivery_address_service import list_delivery_addresses
from app.services.package_service import (
    assign_unidentified_package,
    bulk_update_package_status,
    get_warehouse_summary,
    list_print_queue,
    list_unidentified_packages,
    list_warehouse_packages,
    mark_labels_printed,
    receive_package,
    receive_unidentified_package,
    update_package_status,
    warehouse_package_to_dict,
)
from app.utils.auth_decorators import get_user_from_jwt
from app.services.trn_service import decrypt_trn, format_trn
from app.services.unidentified_service import customer_query
from app.utils.auth_decorators import warehouse_required

staff_bp = Blueprint("staff", __name__)


def _customer_dict(user: User) -> dict:
    return {
        "id": str(user.id),
        "full_name": user.full_name,
        "email": user.email,
        "contact_number": user.contact_number,
        "parish": user.parish,
        "shipping_id": user.shipping_id,
        "trn": format_trn(decrypt_trn(user.trn_encrypted)),
    }


@staff_bp.route("/shippers", methods=["GET"])
@warehouse_required()
def list_shippers():
    return jsonify({"shippers": SHIPPERS})


@staff_bp.route("/staff/warehouse/summary", methods=["GET"])
@warehouse_required()
def warehouse_summary():
    return jsonify(get_warehouse_summary())


@staff_bp.route("/warehouse/customers", methods=["GET"])
@warehouse_required()
def list_customers():
    q = (request.args.get("q") or "").strip()
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)
    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    query = customer_query()

    if q:
        pattern = f"%{q}%"
        shipping_pattern = f"%{q.upper()}%"
        query = query.filter(
            or_(
                User.shipping_id.ilike(shipping_pattern),
                User.first_name.ilike(pattern),
                User.last_name.ilike(pattern),
                User.email.ilike(pattern),
                User.contact_number.ilike(pattern),
            )
        )

    total = query.count()
    users = (
        query.order_by(User.last_name, User.first_name, User.shipping_id)
        .offset(offset)
        .limit(limit)
        .all()
    )

    return jsonify({"customers": [_customer_dict(u) for u in users], "total": total})


@staff_bp.route("/warehouse/customers/search", methods=["GET"])
@warehouse_required()
def search_customers():
    q = (request.args.get("q") or "").strip()
    if len(q) < 2:
        return jsonify({"customers": []})

    pattern = f"%{q}%"
    shipping_pattern = f"%{q.upper()}%"

    users = (
        customer_query()
        .filter(
            or_(
                User.shipping_id.ilike(shipping_pattern),
                User.first_name.ilike(pattern),
                User.last_name.ilike(pattern),
                User.email.ilike(pattern),
                User.contact_number.ilike(pattern),
            )
        )
        .order_by(User.last_name, User.first_name)
        .limit(15)
        .all()
    )

    return jsonify({"customers": [_customer_dict(u) for u in users]})


@staff_bp.route("/staff/customers/<shipping_id>", methods=["GET"])
@warehouse_required()
def lookup_customer(shipping_id: str):
    shipping_id = shipping_id.strip().upper()
    user = customer_query().filter_by(shipping_id=shipping_id).first()
    if not user:
        return jsonify({"error": "Customer not found"}), 404

    return jsonify({"customer": _customer_dict(user)})


@staff_bp.route("/staff/packages/receive", methods=["POST"])
@warehouse_required()
def receive_package_endpoint():
    data = request.get_json(silent=True) or {}
    shipping_id = (data.get("shipping_id") or "").strip().upper()
    weight_raw = data.get("actual_weight_lbs")
    shipper = (data.get("shipper") or "").strip().lower()

    if not shipping_id:
        return jsonify({"error": "shipping_id is required"}), 400
    if weight_raw is None:
        return jsonify({"error": "actual_weight_lbs is required"}), 400
    if not shipper:
        return jsonify({"error": "shipper is required"}), 400
    if shipper not in SHIPPER_CODES:
        return jsonify({"error": "Invalid shipper"}), 400

    try:
        weight = float(weight_raw)
    except (TypeError, ValueError):
        return jsonify({"error": "actual_weight_lbs must be a number"}), 400

    customer = customer_query().filter_by(shipping_id=shipping_id).first()
    if not customer:
        return jsonify({"error": "Customer not found"}), 404

    photo_keys = data.get("photo_keys") or []
    if not isinstance(photo_keys, list):
        return jsonify({"error": "photo_keys must be an array"}), 400

    try:
        package = receive_package(
            customer=customer,
            actual_weight_lbs=weight,
            carrier_tracking=data.get("carrier_tracking"),
            shipper=shipper,
            photo_keys=photo_keys,
            note=data.get("note"),
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    actor = get_user_from_jwt()
    if actor:
        log_package_action(
            actor,
            ACTION_PACKAGE_RECEIVED,
            str(package.id),
            f"Received {package.tracking_number} for {customer.shipping_id} ({package.billable_weight_lbs} lbs)",
            metadata={
                "tracking_number": package.tracking_number,
                "shipping_id": customer.shipping_id,
                "shipper": package.shipper,
                "carrier_tracking": package.carrier_tracking,
                "billable_weight_lbs": package.billable_weight_lbs,
                "estimated_freight_usd": float(package.estimated_freight_usd)
                if package.estimated_freight_usd
                else None,
            },
        )

    pkg_data = package.to_dict(include_events=True, include_photos=True)
    pkg_data["customer"] = _customer_dict(customer)
    return jsonify({"package": pkg_data}), 201


@staff_bp.route("/staff/packages/receive-unidentified", methods=["POST"])
@warehouse_required()
def receive_unidentified_endpoint():
    data = request.get_json(silent=True) or {}
    weight_raw = data.get("actual_weight_lbs")
    shipper = (data.get("shipper") or "").strip().lower()

    if weight_raw is None:
        return jsonify({"error": "actual_weight_lbs is required"}), 400
    if not shipper:
        return jsonify({"error": "shipper is required"}), 400
    if shipper not in SHIPPER_CODES:
        return jsonify({"error": "Invalid shipper"}), 400

    try:
        weight = float(weight_raw)
    except (TypeError, ValueError):
        return jsonify({"error": "actual_weight_lbs must be a number"}), 400

    photo_keys = data.get("photo_keys") or []
    if not isinstance(photo_keys, list):
        return jsonify({"error": "photo_keys must be an array"}), 400

    try:
        package = receive_unidentified_package(
            actual_weight_lbs=weight,
            carrier_tracking=data.get("carrier_tracking"),
            shipper=shipper,
            label_name=data.get("label_name"),
            label_boss_id=data.get("label_boss_id"),
            photo_keys=photo_keys,
            note=data.get("note"),
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    actor = get_user_from_jwt()
    if actor:
        log_package_action(
            actor,
            ACTION_PACKAGE_RECEIVED_UNIDENTIFIED,
            str(package.id),
            f"Queued unidentified {package.tracking_number} ({package.billable_weight_lbs} lbs)",
            metadata={
                "tracking_number": package.tracking_number,
                "label_name": package.label_name,
                "label_boss_id": package.label_boss_id,
                "carrier_tracking": package.carrier_tracking,
                "shipper": package.shipper,
                "billable_weight_lbs": package.billable_weight_lbs,
            },
        )

    return jsonify({"package": package.to_dict(include_events=True, include_photos=True)}), 201


@staff_bp.route("/staff/packages/unidentified", methods=["GET"])
@warehouse_required()
def list_unidentified():
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)
    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    packages, total = list_unidentified_packages(limit=limit, offset=offset)
    return jsonify(
        {
            "packages": [p.to_dict(include_events=True, include_photos=True) for p in packages],
            "total": total,
        }
    )


@staff_bp.route("/staff/packages/<package_id>/assign", methods=["POST"])
@warehouse_required()
def assign_unidentified(package_id: str):
    import uuid as uuid_lib

    data = request.get_json(silent=True) or {}
    shipping_id = (data.get("shipping_id") or "").strip().upper()

    if not shipping_id:
        return jsonify({"error": "shipping_id is required"}), 400

    try:
        pid = uuid_lib.UUID(package_id)
    except ValueError:
        return jsonify({"error": "Invalid package ID"}), 400

    package = Package.query.filter_by(id=pid, status="unidentified").first()
    if not package:
        return jsonify({"error": "Unidentified package not found"}), 404

    customer = customer_query().filter_by(shipping_id=shipping_id).first()
    if not customer:
        return jsonify({"error": "Customer not found"}), 404

    try:
        package = assign_unidentified_package(package, customer, data.get("note"))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    actor = get_user_from_jwt()
    if actor:
        log_package_action(
            actor,
            ACTION_PACKAGE_ASSIGNED,
            str(package.id),
            f"Assigned {package.tracking_number} to {customer.shipping_id} ({customer.full_name})",
            metadata={
                "tracking_number": package.tracking_number,
                "shipping_id": customer.shipping_id,
                "label_name": package.label_name,
                "label_boss_id": package.label_boss_id,
            },
        )

    pkg_data = package.to_dict(include_events=True, include_photos=True)
    pkg_data["customer"] = _customer_dict(customer)
    return jsonify({"package": pkg_data})


@staff_bp.route("/staff/packages", methods=["GET"])
@warehouse_required()
def list_packages():
    from_date = (request.args.get("from") or "").strip()
    to_date = (request.args.get("to") or "").strip()
    status = (request.args.get("status") or "").strip() or None
    limit = request.args.get("limit", 200, type=int)
    offset = request.args.get("offset", 0, type=int)
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    if status and status not in UPDATABLE_STATUSES:
        return jsonify({"error": "Invalid status filter"}), 400

    packages, total = list_warehouse_packages(
        from_date=from_date or None,
        to_date=to_date or None,
        status=status,
        limit=limit,
        offset=offset,
    )

    return jsonify(
        {
            "packages": [warehouse_package_to_dict(p) for p in packages],
            "total": total,
        }
    )


@staff_bp.route("/staff/packages/print-queue", methods=["GET"])
@warehouse_required()
def get_print_queue():
    days = request.args.get("days", 7, type=int)
    limit = request.args.get("limit", 100, type=int)
    offset = request.args.get("offset", 0, type=int)
    days = max(1, min(days, 30))
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    packages, total = list_print_queue(days=days, limit=limit, offset=offset)
    return jsonify(
        {
            "packages": [warehouse_package_to_dict(p) for p in packages],
            "total": total,
        }
    )


@staff_bp.route("/staff/packages/mark-printed", methods=["PATCH"])
@warehouse_required()
def mark_printed():
    data = request.get_json(silent=True) or {}
    package_ids = data.get("package_ids") or []

    if not isinstance(package_ids, list) or not package_ids:
        return jsonify({"error": "package_ids must be a non-empty array"}), 400
    if len(package_ids) > 500:
        return jsonify({"error": "Cannot mark more than 500 packages at once"}), 400

    marked, failed = mark_labels_printed(package_ids)
    return jsonify(
        {
            "marked": len(marked),
            "package_ids": [str(p.id) for p in marked],
            "failed": failed,
        }
    )


@staff_bp.route("/staff/packages/bulk-status", methods=["PATCH"])
@warehouse_required()
def bulk_update_status():
    data = request.get_json(silent=True) or {}
    status = (data.get("status") or "").strip()
    note = data.get("note")
    package_ids = data.get("package_ids") or []

    if not status:
        return jsonify({"error": "status is required"}), 400
    if status not in UPDATABLE_STATUSES:
        return jsonify(
            {
                "error": "Invalid status",
                "allowed": UPDATABLE_STATUSES,
                "labels": STATUS_LABELS,
            }
        ), 400
    if not isinstance(package_ids, list) or not package_ids:
        return jsonify({"error": "package_ids must be a non-empty array"}), 400
    if len(package_ids) > 500:
        return jsonify({"error": "Cannot update more than 500 packages at once"}), 400

    try:
        updated, failed = bulk_update_package_status(package_ids, status, note)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    actor = get_user_from_jwt()
    if actor:
        for package in updated:
            log_package_action(
                actor,
                ACTION_PACKAGE_STATUS_UPDATED,
                str(package.id),
                f"Bulk update {package.tracking_number} → {STATUS_LABELS.get(status, status)}",
                metadata={
                    "tracking_number": package.tracking_number,
                    "to_status": status,
                    "note": note,
                    "bulk": True,
                },
            )

    return jsonify(
        {
            "updated": len(updated),
            "packages": [p.to_dict() for p in updated],
            "failed": failed,
        }
    )


@staff_bp.route("/staff/packages/<tracking_number>/status", methods=["PATCH"])
@warehouse_required()
def update_status(tracking_number: str):
    data = request.get_json(silent=True) or {}
    status = (data.get("status") or "").strip()

    if status not in UPDATABLE_STATUSES:
        return jsonify(
            {
                "error": "Invalid status",
                "allowed": UPDATABLE_STATUSES,
                "labels": STATUS_LABELS,
            }
        ), 400

    tracking_number = tracking_number.strip().upper()
    package = Package.query.filter_by(tracking_number=tracking_number).first()
    if not package:
        return jsonify({"error": "Package not found"}), 404

    if package.status == "unidentified":
        return jsonify(
            {"error": "Unidentified packages must be assigned to a customer before updating status"}
        ), 400

    old_status = package.status
    package = update_package_status(package, status, data.get("note"))

    actor = get_user_from_jwt()
    if actor:
        log_package_action(
            actor,
            ACTION_PACKAGE_STATUS_UPDATED,
            str(package.id),
            f"Updated {package.tracking_number}: {STATUS_LABELS.get(old_status, old_status)} → {STATUS_LABELS.get(status, status)}",
            metadata={
                "tracking_number": package.tracking_number,
                "from_status": old_status,
                "to_status": status,
                "note": data.get("note"),
            },
        )

    return jsonify({"package": package.to_dict(include_events=True)})


@staff_bp.route("/staff/customers/<shipping_id>/delivery-addresses", methods=["GET"])
@warehouse_required()
def list_customer_delivery_addresses(shipping_id: str):
    shipping_id = shipping_id.strip().upper()
    user = customer_query().filter_by(shipping_id=shipping_id).first()
    if not user:
        return jsonify({"error": "Customer not found"}), 404

    addresses = list_delivery_addresses(user)
    return jsonify({"addresses": [a.to_dict() for a in addresses]})


@staff_bp.route("/staff/packages/<package_id>/request-invoice", methods=["POST"])
@warehouse_required()
def request_invoice(package_id: str):
    import uuid as uuid_lib

    try:
        pid = uuid_lib.UUID(package_id)
    except ValueError:
        return jsonify({"error": "Invalid package ID"}), 400

    package = Package.query.get(pid)
    if not package:
        return jsonify({"error": "Package not found"}), 404

    data = request.get_json(silent=True) or {}
    channel = (data.get("channel") or "email").strip().lower()
    note = data.get("note")

    try:
        result = request_package_invoice(package, channel, note)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    actor = get_user_from_jwt()
    if actor:
        log_package_action(
            actor,
            ACTION_PACKAGE_INVOICE_REQUESTED,
            str(package.id),
            f"Requested invoice for {package.tracking_number} via {channel}",
            metadata={
                "tracking_number": package.tracking_number,
                "channel": channel,
                "channels_sent": result["channels_sent"],
                "note": note,
            },
        )

    return jsonify({"package": package.to_dict(), **result})


@staff_bp.route("/staff/packages/<package_id>/billing", methods=["PATCH"])
@warehouse_required()
def update_billing(package_id: str):
    import uuid as uuid_lib

    try:
        pid = uuid_lib.UUID(package_id)
    except ValueError:
        return jsonify({"error": "Invalid package ID"}), 400

    package = Package.query.get(pid)
    if not package:
        return jsonify({"error": "Package not found"}), 404

    data = request.get_json(silent=True) or {}

    try:
        package = update_package_billing(
            package,
            estimated_freight_usd=data.get("estimated_freight_usd"),
            duties_usd=data.get("duties_usd"),
            handling_usd=data.get("handling_usd"),
            other_fees_usd=data.get("other_fees_usd"),
            declared_value_usd=data.get("declared_value_usd"),
            billing_status=data.get("billing_status"),
            publish=bool(data.get("publish")),
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    actor = get_user_from_jwt()
    if actor:
        log_package_action(
            actor,
            ACTION_PACKAGE_BILLING_UPDATED,
            str(package.id),
            f"Updated billing for {package.tracking_number}",
            metadata={
                "tracking_number": package.tracking_number,
                "total_due_usd": float(package.total_due_usd) if package.total_due_usd else None,
                "billing_status": package.billing_status,
                "publish": bool(data.get("publish")),
            },
        )

    return jsonify({"package": package.to_dict()})


@staff_bp.route("/staff/packages/<package_id>/delivery-address", methods=["PATCH"])
@warehouse_required()
def set_package_delivery_address(package_id: str):
    import uuid as uuid_lib

    try:
        pid = uuid_lib.UUID(package_id)
    except ValueError:
        return jsonify({"error": "Invalid package ID"}), 400

    package = Package.query.get(pid)
    if not package:
        return jsonify({"error": "Package not found"}), 404

    data = request.get_json(silent=True) or {}
    address_id = data.get("delivery_address_id")
    if not address_id:
        return jsonify({"error": "delivery_address_id is required"}), 400

    try:
        aid = uuid_lib.UUID(str(address_id))
    except ValueError:
        return jsonify({"error": "Invalid delivery address ID"}), 400

    try:
        package = assign_delivery_address(package, aid, package.customer)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"package": package.to_dict()})
