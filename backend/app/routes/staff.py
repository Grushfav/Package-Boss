from flask import Blueprint, jsonify, request, Response
from sqlalchemy import func, or_

from app.models.pre_alert import PreAlert
from app.constants import MAX_RECEIVE_LBS, PRE_ALERT_STATUSES, SHIPPER_CODES, SHIPPERS, STATUS_LABELS, UPDATABLE_STATUSES
from app.models.package import Package
from app.models.user import User
from app.services.audit_service import (
    ACTION_PACKAGE_ASSIGNED,
    ACTION_PACKAGE_BILLING_UPDATED,
    ACTION_PACKAGE_INVOICE_REQUESTED,
    ACTION_PACKAGE_PAYMENT_RECORDED,
    ACTION_PACKAGE_RECEIVED,
    ACTION_PACKAGE_RECEIVED_UNIDENTIFIED,
    ACTION_PACKAGE_STATUS_UPDATED,
    ACTION_PACKAGE_UNASSIGNED,
    log_package_action,
)
from app.services.delivery_request_service import (
    cancel_delivery_request,
    complete_delivery_request,
    get_delivery_request,
    list_all_delivery_requests,
    list_delivery_request_history,
    list_delivery_requests_by_status,
    list_open_delivery_requests,
    list_pending_customer_delivery_requests,
    list_pending_delivery_requests,
    mark_delivery_request_in_progress,
)
from app.services.bank_transfer_proof_service import (
    confirm_transfer_proof,
    list_all_transfer_proofs,
    list_open_transfer_proofs,
    list_pending_customer_proofs,
    list_pending_transfer_proofs,
    list_transfer_proof_history,
    list_transfer_proofs_by_status,
    get_transfer_proof,
    mark_transfer_proof_in_progress,
    proof_to_staff_dict,
    reject_transfer_proof,
)
from app.services.billing_service import (
    assign_delivery_address,
    request_package_invoice,
    update_package_billing,
)
from app.services.delivery_address_service import list_delivery_addresses
from app.services.customs_release_service import (
    bulk_request_customs_invoices,
    release_packages_from_customs,
)
from app.services.bill_invoice_service import render_bill_invoice_html, render_checkout_invoice_html
from app.models.payment import PaymentCheckout
from app.services.payment_service import (
    compute_customer_billing_summary,
    get_package_checkout_item,
    list_customer_checkouts,
    list_customer_packages,
    package_payment_summaries_for_packages,
    package_payment_summary,
    record_package_payment,
    record_payment_checkout,
)
from app.services.package_service import (
    _warehouse_list_load_options,
    assign_unidentified_package,
    unassign_package_from_customer,
    bulk_update_package_status,
    get_warehouse_summary,
    list_clerk_receives_today,
    list_label_log,
    list_unidentified_packages,
    list_warehouse_packages,
    mark_labels_printed,
    receive_package,
    receive_unidentified_package,
    update_package_status,
    warehouse_package_list_to_dict,
    warehouse_package_to_dict,
)
from app.services.package_search_service import MIN_PACKAGE_SEARCH_QUERY_LEN, search_packages
from app.services.pre_alert_service import find_pending_pre_alerts_by_tracking
from app.utils.auth_decorators import admin_required, get_user_from_jwt, permission_required, warehouse_required
from app.services.clerk_permission_service import assert_status_transition_allowed, clerk_has_permission
from app.services.unidentified_service import customer_query

staff_bp = Blueprint("staff", __name__)


def _customer_dict(user: User, *, active_package_count: int | None = None) -> dict:
    data = {
        "id": str(user.id),
        "full_name": user.full_name,
        "email": user.email,
        "contact_number": user.contact_number or "",
        "parish": user.parish or "",
        "shipping_id": user.shipping_id,
    }
    if active_package_count is not None:
        data["active_package_count"] = active_package_count
    return data


def _active_package_counts(user_ids: list) -> dict:
    if not user_ids:
        return {}
    rows = (
        Package.query.with_entities(Package.customer_id, func.count(Package.id))
        .filter(Package.customer_id.in_(user_ids), Package.status != "delivered")
        .group_by(Package.customer_id)
        .all()
    )
    return {customer_id: count for customer_id, count in rows}


def _parse_receive_weight(weight_raw) -> tuple[float | None, tuple[dict, int] | None]:
    try:
        weight = float(weight_raw)
    except (TypeError, ValueError):
        return None, ({"error": "actual_weight_lbs must be a number"}, 400)
    if weight <= 0:
        return None, ({"error": "actual_weight_lbs must be greater than zero"}, 400)
    if weight > MAX_RECEIVE_LBS:
        return None, (
            {
                "error": (
                    f"Packages over {MAX_RECEIVE_LBS} lbs cannot be received here. "
                    "Contact support@packageboss.com."
                )
            },
            400,
        )
    return weight, None


@staff_bp.route("/shippers", methods=["GET"])
@permission_required("receive")
def list_shippers():
    return jsonify({"shippers": SHIPPERS})


@staff_bp.route("/staff/warehouse/summary", methods=["GET"])
@permission_required("receive", "activity", "pre_alerts", "status_transit", "status_customs", "status_pickup", "billing", "invoice_request", "directory")
def warehouse_summary():
    return jsonify(get_warehouse_summary())


@staff_bp.route("/warehouse/customers", methods=["GET"])
@permission_required("directory")
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

    counts = _active_package_counts([u.id for u in users])
    return jsonify(
        {
            "customers": [
                _customer_dict(u, active_package_count=counts.get(u.id, 0)) for u in users
            ],
            "total": total,
        }
    )


@staff_bp.route("/warehouse/customers/search", methods=["GET"])
@permission_required("receive", "directory")
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
@permission_required("receive", "directory")
def lookup_customer(shipping_id: str):
    shipping_id = shipping_id.strip().upper()
    user = customer_query().filter_by(shipping_id=shipping_id).first()
    if not user:
        return jsonify({"error": "Customer not found"}), 404

    return jsonify({"customer": _customer_dict(user)})


@staff_bp.route("/staff/pre-alerts/lookup", methods=["GET"])
@permission_required("receive", "pre_alerts")
def lookup_pre_alert_by_tracking():
    tracking = (request.args.get("carrier_tracking") or "").strip()
    if not tracking:
        return jsonify({"error": "carrier_tracking is required"}), 400

    scored = find_pending_pre_alerts_by_tracking(tracking)
    matches = []
    for pre_alert, score in scored:
        customer = pre_alert.customer
        if not customer:
            continue
        matches.append(
            {
                "pre_alert": pre_alert.to_dict(),
                "customer": _customer_dict(customer),
                "match_score": score,
            }
        )

    return jsonify({"matches": matches})


def _staff_pre_alert_dict(pre_alert: PreAlert) -> dict:
    data = pre_alert.to_dict()
    customer = pre_alert.customer
    if customer:
        data["customer"] = _customer_dict(customer)
    return data


@staff_bp.route("/staff/pre-alerts", methods=["GET"])
@permission_required("pre_alerts")
def list_pre_alerts():
    q = (request.args.get("q") or "").strip()
    status = (request.args.get("status") or "").strip()
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)
    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    query = PreAlert.query.join(User, PreAlert.customer_id == User.id)

    if status and status in PRE_ALERT_STATUSES:
        query = query.filter(PreAlert.status == status)

    if q:
        pattern = f"%{q}%"
        shipping_pattern = f"%{q.upper()}%"
        query = query.filter(
            or_(
                PreAlert.carrier_tracking.ilike(pattern),
                PreAlert.merchant.ilike(pattern),
                PreAlert.description.ilike(pattern),
                User.shipping_id.ilike(shipping_pattern),
                User.first_name.ilike(pattern),
                User.last_name.ilike(pattern),
            )
        )

    total = query.count()
    alerts = (
        query.order_by(PreAlert.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return jsonify(
        {
            "pre_alerts": [_staff_pre_alert_dict(alert) for alert in alerts],
            "total": total,
        }
    )


@staff_bp.route("/staff/customers/<shipping_id>/account", methods=["GET"])
@permission_required("directory", "billing")
def customer_account(shipping_id: str):
    shipping_id = shipping_id.strip().upper()
    user = customer_query().filter_by(shipping_id=shipping_id).first()
    if not user:
        return jsonify({"error": "Customer not found"}), 404

    packages = list_customer_packages(user)
    actor = get_user_from_jwt()
    show_billing = actor and clerk_has_permission(actor, "billing")

    payment_map = package_payment_summaries_for_packages(packages) if show_billing else {}
    package_rows = []
    for pkg in packages:
        row = warehouse_package_list_to_dict(pkg)
        if show_billing:
            row["payment"] = payment_map.get(str(pkg.id))
        package_rows.append(row)

    payload = {
        "customer": _customer_dict(user),
        "packages": package_rows,
    }
    if show_billing:
        checkouts = list_customer_checkouts(user)
        summary = compute_customer_billing_summary(packages)
        payload["checkouts"] = [c.to_dict(include_items=True) for c in checkouts]
        payload["summary"] = summary
        pending_proofs = list_pending_customer_proofs(user)
        payload["pending_transfer_proofs"] = [
            p.to_dict(include_packages=True) for p in pending_proofs
        ]
        pending_deliveries = list_pending_customer_delivery_requests(user)
        payload["pending_delivery_requests"] = [
            item.to_dict(include_packages=True) for item in pending_deliveries
        ]

    return jsonify(payload)


@staff_bp.route("/staff/packages/release-from-customs", methods=["POST"])
@permission_required("status_customs", "billing")
def release_from_customs():
    data = request.get_json(silent=True) or {}
    items = data.get("items") or []
    note = data.get("note")

    if not isinstance(items, list) or not items:
        return jsonify({"error": "items must be a non-empty array"}), 400

    released, failed = release_packages_from_customs(items, note=note)

    actor = get_user_from_jwt()
    if actor:
        for package in released:
            log_package_action(
                actor,
                ACTION_PACKAGE_BILLING_UPDATED,
                str(package.id),
                f"Released {package.tracking_number} from customs — bill published",
                metadata={
                    "tracking_number": package.tracking_number,
                    "to_status": "ready_for_pickup",
                    "total_due_jmd": float(package.total_due_jmd) if package.total_due_jmd else None,
                    "bulk": len(items) > 1,
                },
            )

    return jsonify(
        {
            "released": len(released),
            "packages": [warehouse_package_to_dict(p) for p in released],
            "failed": failed,
        }
    )


@staff_bp.route("/staff/packages/bulk-request-invoice", methods=["POST"])
@permission_required("invoice_request")
def bulk_request_invoice():
    data = request.get_json(silent=True) or {}
    package_ids = data.get("package_ids") or []
    channel = (data.get("channel") or "email").strip().lower()
    note = data.get("note")

    if channel not in ("email", "whatsapp", "both"):
        return jsonify({"error": "Invalid channel"}), 400
    if not isinstance(package_ids, list) or not package_ids:
        return jsonify({"error": "package_ids must be a non-empty array"}), 400
    if len(package_ids) > 500:
        return jsonify({"error": "Cannot request more than 500 invoices at once"}), 400

    sent, failed = bulk_request_customs_invoices(package_ids, channel, note)

    actor = get_user_from_jwt()
    if actor:
        for item in sent:
            log_package_action(
                actor,
                ACTION_PACKAGE_INVOICE_REQUESTED,
                item["package_id"],
                f"Bulk invoice request for {item['tracking_number']} via {channel}",
                metadata={
                    "tracking_number": item["tracking_number"],
                    "channel": channel,
                    "channels_sent": item.get("channels_sent"),
                    "bulk": True,
                },
            )

    return jsonify({"sent": len(sent), "results": sent, "failed": failed})


@staff_bp.route("/staff/customers/<shipping_id>/checkouts", methods=["POST"])
@permission_required("billing")
def customer_checkout(shipping_id: str):
    shipping_id = shipping_id.strip().upper()
    user = customer_query().filter_by(shipping_id=shipping_id).first()
    if not user:
        return jsonify({"error": "Customer not found"}), 404

    data = request.get_json(silent=True) or {}
    package_ids = data.get("package_ids") or []
    method = (data.get("method") or "").strip().lower()
    if not method:
        return jsonify({"error": "method is required"}), 400
    if not isinstance(package_ids, list):
        return jsonify({"error": "package_ids must be an array"}), 400

    actor = get_user_from_jwt()
    if not actor:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        checkout = record_payment_checkout(
            user,
            package_ids,
            method=method,
            recorded_by=actor,
            reference=data.get("reference"),
            notes=data.get("notes"),
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    for item in checkout.items:
        log_package_action(
            actor,
            ACTION_PACKAGE_PAYMENT_RECORDED,
            str(item.package_id),
            f"Checkout {checkout.invoice_number} — {checkout.method}",
            metadata={
                "checkout_id": str(checkout.id),
                "invoice_number": checkout.invoice_number,
                "amount_jmd": float(item.amount_jmd),
                "method": checkout.method,
                "reference": checkout.reference,
                "package_count": len(checkout.items),
            },
        )

    return jsonify({"checkout": checkout.to_dict(include_items=True)}), 201


@staff_bp.route("/staff/checkouts/<checkout_id>/bill-invoice", methods=["GET"])
@permission_required("billing")
def checkout_bill_invoice(checkout_id: str):
    import uuid as uuid_lib

    try:
        cid = uuid_lib.UUID(checkout_id)
    except ValueError:
        return jsonify({"error": "Invalid checkout ID"}), 400

    checkout = PaymentCheckout.query.get(cid)
    if not checkout:
        return jsonify({"error": "Checkout not found"}), 404

    packages = [item.package for item in checkout.items if item.package]
    customer = checkout.customer
    html = render_checkout_invoice_html(checkout, customer, packages)
    return Response(html, mimetype="text/html")


@staff_bp.route("/staff/packages/<package_id>/payments", methods=["POST"])
@permission_required("billing")
def record_payment(package_id: str):
    import uuid as uuid_lib

    try:
        pid = uuid_lib.UUID(package_id)
    except ValueError:
        return jsonify({"error": "Invalid package ID"}), 400

    package = Package.query.get(pid)
    if not package:
        return jsonify({"error": "Package not found"}), 404

    data = request.get_json(silent=True) or {}
    method = (data.get("method") or "").strip().lower()
    if not method:
        return jsonify({"error": "method is required"}), 400

    actor = get_user_from_jwt()
    if not actor:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        checkout = record_package_payment(
            package,
            method=method,
            recorded_by=actor,
            reference=data.get("reference"),
            notes=data.get("notes"),
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    log_package_action(
        actor,
        ACTION_PACKAGE_PAYMENT_RECORDED,
        str(package.id),
        f"Recorded payment for {package.tracking_number} — {checkout.invoice_number} ({checkout.method})",
        metadata={
            "tracking_number": package.tracking_number,
            "checkout_id": str(checkout.id),
            "invoice_number": checkout.invoice_number,
            "amount_jmd": float(checkout.total_jmd),
            "method": checkout.method,
            "reference": checkout.reference,
        },
    )

    pkg_data = package.to_dict()
    pkg_data["payment"] = package_payment_summary(package)
    return jsonify({"package": pkg_data, "checkout": checkout.to_dict(include_items=True)}), 201


@staff_bp.route("/staff/packages/<package_id>/bill-invoice", methods=["GET"])
@permission_required("billing")
def package_bill_invoice(package_id: str):
    import uuid as uuid_lib

    try:
        pid = uuid_lib.UUID(package_id)
    except ValueError:
        return jsonify({"error": "Invalid package ID"}), 400

    package = Package.query.get(pid)
    if not package:
        return jsonify({"error": "Package not found"}), 404

    if package.billing_status not in ("ready", "paid"):
        return jsonify({"error": "Bill has not been published yet"}), 400

    if package.total_due_jmd is None:
        return jsonify({"error": "No bill amount on this package"}), 400

    item = get_package_checkout_item(package)
    checkout = item.checkout if item else None
    customer = package.customer
    if checkout and len(checkout.items) > 1:
        packages = [i.package for i in checkout.items if i.package]
        html = render_checkout_invoice_html(checkout, customer, packages)
    else:
        html = render_bill_invoice_html(package, customer, checkout)
    return Response(html, mimetype="text/html")


@staff_bp.route("/staff/packages/receive", methods=["POST"])
@permission_required("receive")
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

    weight, weight_error = _parse_receive_weight(weight_raw)
    if weight_error:
        body, status = weight_error
        return jsonify(body), status

    customer = customer_query().filter_by(shipping_id=shipping_id).first()
    if not customer:
        return jsonify({"error": "Customer not found"}), 404

    photo_keys = data.get("photo_keys") or []
    if not isinstance(photo_keys, list):
        return jsonify({"error": "photo_keys must be an array"}), 400

    try:
        package, matched_pre_alert = receive_package(
            customer=customer,
            actual_weight_lbs=weight,
            carrier_tracking=data.get("carrier_tracking"),
            shipper=shipper,
            photo_keys=photo_keys,
            note=data.get("note"),
            receive_batch_id=data.get("receive_batch_id"),
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
                "estimated_freight_jmd": float(package.estimated_freight_jmd)
                if package.estimated_freight_jmd
                else None,
                "pre_alert_matched": matched_pre_alert is not None,
                "receive_batch_id": str(package.receive_batch_id) if package.receive_batch_id else None,
                "receive_batch_code": package.receive_batch.batch_code if package.receive_batch else None,
            },
        )

    pkg_data = package.to_dict(include_events=True, include_photos=True)
    pkg_data["customer"] = _customer_dict(customer)
    response = {"package": pkg_data}
    if matched_pre_alert:
        response["pre_alert_matched"] = matched_pre_alert.to_dict()
    return jsonify(response), 201


@staff_bp.route("/staff/packages/receive-unidentified", methods=["POST"])
@permission_required("receive")
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

    weight, weight_error = _parse_receive_weight(weight_raw)
    if weight_error:
        body, status = weight_error
        return jsonify(body), status

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
            receive_batch_id=data.get("receive_batch_id"),
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
                "receive_batch_id": str(package.receive_batch_id) if package.receive_batch_id else None,
                "receive_batch_code": package.receive_batch.batch_code if package.receive_batch else None,
            },
        )

    return jsonify({"package": package.to_dict(include_events=True, include_photos=True)}), 201


@staff_bp.route("/staff/packages/unidentified", methods=["GET"])
@permission_required("receive")
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
@permission_required("receive")
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
        package, matched_pre_alert = assign_unidentified_package(package, customer, data.get("note"))
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
                "pre_alert_matched": matched_pre_alert is not None,
            },
        )

    pkg_data = package.to_dict(include_events=True, include_photos=True)
    pkg_data["customer"] = _customer_dict(customer)
    response = {"package": pkg_data}
    if matched_pre_alert:
        response["pre_alert_matched"] = matched_pre_alert.to_dict()
    return jsonify(response)


@staff_bp.route("/staff/packages/<package_id>/unassign", methods=["POST"])
@admin_required()
def unassign_package_customer(package_id: str):
    import uuid as uuid_lib

    data = request.get_json(silent=True) or {}
    note = (data.get("note") or "").strip() or None
    if note and len(note) > 500:
        return jsonify({"error": "note must be 500 characters or fewer"}), 400

    try:
        pid = uuid_lib.UUID(package_id)
    except ValueError:
        return jsonify({"error": "Invalid package ID"}), 400

    package = Package.query.get(pid)
    if not package:
        return jsonify({"error": "Package not found"}), 404

    previous_customer = package.customer

    try:
        package, previous_customer = unassign_package_from_customer(package, note=note)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    actor = get_user_from_jwt()
    if actor:
        log_package_action(
            actor,
            ACTION_PACKAGE_UNASSIGNED,
            str(package.id),
            f"Unassigned {package.tracking_number} from {previous_customer.shipping_id} ({previous_customer.full_name})",
            metadata={
                "tracking_number": package.tracking_number,
                "previous_shipping_id": previous_customer.shipping_id,
                "previous_customer_id": str(previous_customer.id),
            },
        )

    pkg_data = package.to_dict(include_events=True, include_photos=True)
    return jsonify(
        {
            "package": pkg_data,
            "previous_customer": _customer_dict(previous_customer),
        }
    )


@staff_bp.route("/staff/packages", methods=["GET"])
@permission_required("status_transit", "status_customs", "status_pickup", "billing", "receive")
def list_packages():
    from_date = (request.args.get("from") or "").strip()
    to_date = (request.args.get("to") or "").strip()
    status = (request.args.get("status") or "").strip() or None
    limit = request.args.get("limit", 100, type=int)
    offset = request.args.get("offset", 0, type=int)
    limit = max(1, min(limit, 100))
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
            "packages": [warehouse_package_list_to_dict(p) for p in packages],
            "total": total,
        }
    )


@staff_bp.route("/staff/packages/search", methods=["GET"])
@warehouse_required()
def search_packages_route():
    q = (request.args.get("q") or "").strip()
    limit = request.args.get("limit", 20, type=int)

    if len(q) < MIN_PACKAGE_SEARCH_QUERY_LEN:
        return jsonify({"matches": [], "truncated": False})

    matches, truncated = search_packages(q, limit=limit)
    return jsonify({"matches": matches, "truncated": truncated})


@staff_bp.route("/staff/packages/lookup/<tracking_number>", methods=["GET"])
@permission_required("status_transit", "status_customs", "status_pickup", "billing", "receive")
def lookup_package_by_tracking(tracking_number: str):
    tracking_number = tracking_number.strip().upper()
    package = (
        Package.query.options(*_warehouse_list_load_options())
        .filter_by(tracking_number=tracking_number)
        .first()
    )
    if not package:
        return jsonify({"error": "Package not found"}), 404
    return jsonify({"package": warehouse_package_to_dict(package)})


@staff_bp.route("/staff/packages/my-recent-receives", methods=["GET"])
@permission_required("receive")
def get_my_recent_receives():
    actor = get_user_from_jwt()
    if not actor:
        return jsonify({"error": "Unauthorized"}), 401

    limit = request.args.get("limit", 3, type=int)
    limit = max(1, min(limit, 10))
    receives = list_clerk_receives_today(actor.id, limit=limit)
    return jsonify({"receives": receives})


@staff_bp.route("/staff/packages/print-queue", methods=["GET"])
@permission_required("receive")
def get_print_queue():
    days = request.args.get("days", 7, type=int)
    limit = request.args.get("limit", 100, type=int)
    offset = request.args.get("offset", 0, type=int)
    pending_only_raw = request.args.get("pending_only", "true")
    pending_only = str(pending_only_raw).lower() not in ("0", "false", "no")
    days = max(1, min(days, 30))
    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    packages, total = list_label_log(
        days=days, limit=limit, offset=offset, pending_only=pending_only
    )
    return jsonify(
        {
            "packages": [warehouse_package_to_dict(p) for p in packages],
            "total": total,
        }
    )


@staff_bp.route("/staff/packages/mark-printed", methods=["PATCH"])
@permission_required("receive")
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
@permission_required("status_transit", "status_customs", "status_pickup")
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

    actor = get_user_from_jwt()
    if actor and actor.role == "clerk":
        import uuid as uuid_lib

        for raw_id in package_ids:
            try:
                pid = uuid_lib.UUID(str(raw_id))
            except ValueError:
                continue
            package = Package.query.get(pid)
            if not package:
                continue
            try:
                assert_status_transition_allowed(actor, package.status, status)
            except ValueError as exc:
                return jsonify({"error": str(exc)}), 403

    try:
        updated, failed = bulk_update_package_status(package_ids, status, note)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

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
@permission_required("status_transit", "status_customs", "status_pickup")
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
    actor = get_user_from_jwt()
    if actor:
        try:
            assert_status_transition_allowed(actor, old_status, status)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 403

    package = update_package_status(package, status, data.get("note"))

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
@permission_required("billing", "directory")
def list_customer_delivery_addresses(shipping_id: str):
    shipping_id = shipping_id.strip().upper()
    user = customer_query().filter_by(shipping_id=shipping_id).first()
    if not user:
        return jsonify({"error": "Customer not found"}), 404

    addresses = list_delivery_addresses(user)
    return jsonify({"addresses": [a.to_dict() for a in addresses]})


@staff_bp.route("/staff/packages/<package_id>/request-invoice", methods=["POST"])
@permission_required("invoice_request")
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
@permission_required("billing")
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
            estimated_freight_jmd=data.get("estimated_freight_jmd", data.get("estimated_freight_usd")),
            duties_jmd=data.get("duties_jmd", data.get("duties_usd")),
            handling_jmd=data.get("handling_jmd", data.get("handling_usd")),
            other_fees_jmd=data.get("other_fees_jmd", data.get("other_fees_usd")),
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
                "total_due_jmd": float(package.total_due_jmd) if package.total_due_jmd else None,
                "billing_status": package.billing_status,
                "publish": bool(data.get("publish")),
            },
        )

    return jsonify({"package": package.to_dict()})


@staff_bp.route("/staff/packages/<package_id>/delivery-address", methods=["PATCH"])
@permission_required("billing")
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


@staff_bp.route("/staff/shipments", methods=["GET"])
@permission_required("status_transit")
def list_shipments_route():
    from app.constants import SHIPMENT_STATUSES
    from app.services.shipment_service import list_shipments

    status = (request.args.get("status") or "").strip() or None
    if status and status not in SHIPMENT_STATUSES:
        return jsonify({"error": "Invalid status"}), 400

    try:
        limit = min(int(request.args.get("limit", 50)), 200)
        offset = max(int(request.args.get("offset", 0)), 0)
    except ValueError:
        return jsonify({"error": "Invalid pagination"}), 400

    shipments, total = list_shipments(status=status, limit=limit, offset=offset)
    return jsonify(
        {
            "shipments": [s.to_dict() for s in shipments],
            "total": total,
        }
    )


@staff_bp.route("/staff/shipments", methods=["POST"])
@permission_required("status_transit")
def create_shipment_route():
    from datetime import date as date_type

    from app.services.shipment_service import create_shipment

    data = request.get_json(silent=True) or {}
    reference = (data.get("reference") or "").strip()
    note = data.get("note")
    raw_date = (data.get("departure_date") or "").strip()

    if not reference:
        return jsonify({"error": "reference is required"}), 400
    if not raw_date:
        return jsonify({"error": "departure_date is required"}), 400

    try:
        departure_date = date_type.fromisoformat(raw_date)
    except ValueError:
        return jsonify({"error": "departure_date must be YYYY-MM-DD"}), 400

    actor = get_user_from_jwt()
    try:
        shipment = create_shipment(
            reference=reference,
            departure_date=departure_date,
            note=note,
            created_by=actor,
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"shipment": shipment.to_dict()}), 201


@staff_bp.route("/staff/shipments/<shipment_id>", methods=["GET"])
@permission_required("status_transit")
def get_shipment_route(shipment_id: str):
    import uuid as uuid_lib

    from app.services.shipment_service import get_shipment

    try:
        sid = uuid_lib.UUID(shipment_id)
    except ValueError:
        return jsonify({"error": "Invalid shipment ID"}), 400

    shipment = get_shipment(sid)
    if not shipment:
        return jsonify({"error": "Departure not found"}), 404

    return jsonify({"shipment": shipment.to_dict(include_packages=True)})


@staff_bp.route("/staff/shipments/<shipment_id>/packages", methods=["POST"])
@permission_required("status_transit")
def add_shipment_packages_route(shipment_id: str):
    import uuid as uuid_lib

    from app.services.shipment_service import add_package_by_tracking, add_packages_to_shipment, get_shipment

    try:
        sid = uuid_lib.UUID(shipment_id)
    except ValueError:
        return jsonify({"error": "Invalid shipment ID"}), 400

    shipment = get_shipment(sid)
    if not shipment:
        return jsonify({"error": "Departure not found"}), 404

    data = request.get_json(silent=True) or {}
    tracking = (data.get("tracking_number") or "").strip()
    package_ids = data.get("package_ids") or []
    actor = get_user_from_jwt()

    try:
        if tracking:
            package = add_package_by_tracking(shipment, tracking, actor=actor)
            from app.services.package_service import warehouse_package_to_dict

            return jsonify({"package": warehouse_package_to_dict(package)})
        if not isinstance(package_ids, list) or not package_ids:
            return jsonify({"error": "tracking_number or package_ids is required"}), 400
        added, failed = add_packages_to_shipment(shipment, package_ids, actor=actor)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    from app.services.package_service import warehouse_package_to_dict

    return jsonify(
        {
            "added": len(added),
            "packages": [warehouse_package_to_dict(p) for p in added],
            "failed": failed,
        }
    )


@staff_bp.route("/staff/shipments/<shipment_id>/packages/<package_id>", methods=["DELETE"])
@permission_required("status_transit")
def remove_shipment_package_route(shipment_id: str, package_id: str):
    import uuid as uuid_lib

    from app.services.shipment_service import get_shipment, remove_package_from_shipment

    try:
        sid = uuid_lib.UUID(shipment_id)
        pid = uuid_lib.UUID(package_id)
    except ValueError:
        return jsonify({"error": "Invalid ID"}), 400

    shipment = get_shipment(sid)
    if not shipment:
        return jsonify({"error": "Departure not found"}), 404

    package = Package.query.get(pid)
    if not package:
        return jsonify({"error": "Package not found"}), 404

    actor = get_user_from_jwt()
    try:
        remove_package_from_shipment(shipment, package, actor=actor)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"ok": True})


@staff_bp.route("/staff/shipments/<shipment_id>/depart", methods=["POST"])
@permission_required("status_transit")
def depart_shipment_route(shipment_id: str):
    import uuid as uuid_lib

    from app.services.shipment_service import depart_shipment, get_shipment

    try:
        sid = uuid_lib.UUID(shipment_id)
    except ValueError:
        return jsonify({"error": "Invalid shipment ID"}), 400

    shipment = get_shipment(sid)
    if not shipment:
        return jsonify({"error": "Departure not found"}), 404

    data = request.get_json(silent=True) or {}
    note = data.get("note")
    actor = get_user_from_jwt()

    if actor and actor.role == "clerk":
        try:
            assert_status_transition_allowed(actor, "received", "in_transit")
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 403

    try:
        updated, failed = depart_shipment(shipment, actor=actor, note=note)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    from app.services.package_service import warehouse_package_to_dict

    return jsonify(
        {
            "shipment": shipment.to_dict(include_packages=True),
            "updated": len(updated),
            "packages": [warehouse_package_to_dict(p) for p in updated],
            "failed": failed,
        }
    )


@staff_bp.route("/staff/shipments/batch-depart", methods=["POST"])
@permission_required("status_transit")
def batch_depart_packages_route():
    import uuid as uuid_lib
    from datetime import date as date_type

    from app.services.shipment_service import batch_depart_packages

    data = request.get_json(silent=True) or {}
    package_ids = data.get("package_ids") or []
    note = data.get("note")
    raw_shipment_id = (data.get("shipment_id") or "").strip()
    reference = (data.get("reference") or "").strip()
    raw_date = (data.get("departure_date") or "").strip()

    if not isinstance(package_ids, list) or not package_ids:
        return jsonify({"error": "package_ids must be a non-empty array"}), 400

    shipment_id = None
    if raw_shipment_id:
        try:
            shipment_id = uuid_lib.UUID(raw_shipment_id)
        except ValueError:
            return jsonify({"error": "Invalid shipment_id"}), 400

    departure_date = None
    if raw_date:
        try:
            departure_date = date_type.fromisoformat(raw_date)
        except ValueError:
            return jsonify({"error": "departure_date must be YYYY-MM-DD"}), 400

    actor = get_user_from_jwt()
    if actor and actor.role == "clerk":
        try:
            assert_status_transition_allowed(actor, "received", "in_transit")
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 403

    try:
        shipment, updated = batch_depart_packages(
            package_ids,
            shipment_id=shipment_id,
            reference=reference or None,
            departure_date=departure_date,
            note=note,
            actor=actor,
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    from app.services.package_service import warehouse_package_to_dict

    return jsonify(
        {
            "shipment": shipment.to_dict(include_packages=True),
            "updated": len(updated),
            "packages": [warehouse_package_to_dict(p) for p in updated],
            "failed": [],
        }
    )


@staff_bp.route("/staff/receive-batches", methods=["GET"])
@permission_required("receive")
def list_receive_batches_route():
    from app.constants import RECEIVE_BATCH_STATUSES
    from app.services.receive_batch_service import list_receive_batches

    status = (request.args.get("status") or "").strip() or None
    if status and status not in RECEIVE_BATCH_STATUSES:
        return jsonify({"error": "Invalid status"}), 400

    try:
        limit = min(int(request.args.get("limit", 50)), 200)
        offset = max(int(request.args.get("offset", 0)), 0)
    except ValueError:
        return jsonify({"error": "Invalid pagination"}), 400

    batches, total = list_receive_batches(status=status, limit=limit, offset=offset)
    return jsonify(
        {
            "receive_batches": [batch.to_dict() for batch in batches],
            "total": total,
        }
    )


@staff_bp.route("/staff/receive-batches", methods=["POST"])
@permission_required("receive")
def create_receive_batch_route():
    from datetime import date as date_type

    from app.services.receive_batch_service import create_receive_batch

    data = request.get_json(silent=True) or {}
    reference = (data.get("reference") or "").strip() or None
    note = data.get("note")
    raw_date = (data.get("receive_date") or "").strip()

    receive_date = None
    if raw_date:
        try:
            receive_date = date_type.fromisoformat(raw_date)
        except ValueError:
            return jsonify({"error": "receive_date must be YYYY-MM-DD"}), 400

    actor = get_user_from_jwt()
    try:
        batch = create_receive_batch(
            reference=reference,
            receive_date=receive_date,
            note=note,
            created_by=actor,
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"receive_batch": batch.to_dict()}), 201


@staff_bp.route("/staff/delivery-requests", methods=["GET"])
@permission_required("status_pickup", "billing")
def list_staff_delivery_requests():
    status = (request.args.get("status") or "active").strip().lower()
    if status == "pending":
        requests = list_pending_delivery_requests()
    elif status == "active":
        requests = list_open_delivery_requests()
    elif status == "all":
        requests = list_all_delivery_requests()
    elif status == "history":
        requests = list_delivery_request_history()
    elif status == "in_progress":
        requests = list_delivery_requests_by_status("in_progress")
    else:
        requests = list_delivery_requests_by_status(status)
    return jsonify(
        {"delivery_requests": [item.to_dict(include_packages=True) for item in requests]}
    )


@staff_bp.route("/staff/delivery-requests/<request_id>/in-progress", methods=["POST"])
@permission_required("status_pickup", "billing")
def mark_staff_delivery_in_progress(request_id: str):
    delivery_request = get_delivery_request(request_id)
    if not delivery_request:
        return jsonify({"error": "Delivery request not found"}), 404

    actor = get_user_from_jwt()
    if not actor:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        delivery_request = mark_delivery_request_in_progress(delivery_request, actor)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"delivery_request": delivery_request.to_dict(include_packages=True)})


@staff_bp.route("/staff/delivery-requests/<request_id>/complete", methods=["POST"])
@permission_required("status_pickup")
def complete_staff_delivery_request(request_id: str):
    delivery_request = get_delivery_request(request_id)
    if not delivery_request:
        return jsonify({"error": "Delivery request not found"}), 404

    actor = get_user_from_jwt()
    if not actor:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        delivery_request = complete_delivery_request(delivery_request, actor)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"delivery_request": delivery_request.to_dict(include_packages=True)})


@staff_bp.route("/staff/delivery-requests/<request_id>/cancel", methods=["POST"])
@permission_required("status_pickup", "billing")
def cancel_staff_delivery_request(request_id: str):
    delivery_request = get_delivery_request(request_id)
    if not delivery_request:
        return jsonify({"error": "Delivery request not found"}), 404

    try:
        delivery_request = cancel_delivery_request(delivery_request, by_customer=False)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"delivery_request": delivery_request.to_dict(include_packages=True)})


@staff_bp.route("/staff/bank-transfer-proofs", methods=["GET"])
@permission_required("billing")
def list_staff_bank_transfer_proofs():
    status = (request.args.get("status") or "active").strip().lower()
    if status == "pending":
        proofs = list_pending_transfer_proofs()
    elif status == "active":
        proofs = list_open_transfer_proofs()
    elif status == "all":
        proofs = list_all_transfer_proofs()
    elif status == "history":
        proofs = list_transfer_proof_history()
    elif status == "in_progress":
        proofs = list_transfer_proofs_by_status("in_progress")
    else:
        proofs = list_transfer_proofs_by_status(status)
    return jsonify({"proofs": [proof_to_staff_dict(proof) for proof in proofs]})


@staff_bp.route("/staff/bank-transfer-proofs/<proof_id>/in-progress", methods=["POST"])
@permission_required("billing")
def mark_staff_transfer_in_progress(proof_id: str):
    proof = get_transfer_proof(proof_id)
    if not proof:
        return jsonify({"error": "Transfer proof not found"}), 404

    actor = get_user_from_jwt()
    if not actor:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        proof = mark_transfer_proof_in_progress(proof, actor)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"proof": proof_to_staff_dict(proof)})


@staff_bp.route("/staff/bank-transfer-proofs/<proof_id>/confirm", methods=["POST"])
@permission_required("billing")
def confirm_staff_bank_transfer_proof(proof_id: str):
    proof = get_transfer_proof(proof_id)
    if not proof:
        return jsonify({"error": "Transfer proof not found"}), 404

    actor = get_user_from_jwt()
    if not actor:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        proof = confirm_transfer_proof(proof, actor)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"proof": proof_to_staff_dict(proof)})


@staff_bp.route("/staff/bank-transfer-proofs/<proof_id>/reject", methods=["POST"])
@permission_required("billing")
def reject_staff_bank_transfer_proof(proof_id: str):
    proof = get_transfer_proof(proof_id)
    if not proof:
        return jsonify({"error": "Transfer proof not found"}), 404

    actor = get_user_from_jwt()
    if not actor:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        proof = reject_transfer_proof(proof, actor)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"proof": proof_to_staff_dict(proof)})
