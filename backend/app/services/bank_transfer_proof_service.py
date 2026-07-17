from datetime import datetime
from decimal import Decimal

from app.constants import BANK_TRANSFER_PROOF_OPEN_STATUSES, PAYMENT_ELIGIBLE_STATUS
from app.extensions import db
from app.models.bank_transfer_proof import BankTransferProof, BankTransferProofPackage
from app.models.package import Package
from app.models.user import User
from app.services.delivery_request_service import compute_payment_total_with_delivery
from app.services.image_upload_service import is_valid_transfer_proof_reference


def _decimal(value) -> Decimal | None:
    if value is None:
        return None
    return Decimal(str(value)).quantize(Decimal("0.01"))


def list_customer_proofs(customer: User, limit: int = 50) -> list[BankTransferProof]:
    return (
        BankTransferProof.query.filter_by(customer_id=customer.id)
        .order_by(BankTransferProof.submitted_at.desc())
        .limit(limit)
        .all()
    )


def list_open_customer_proofs(customer: User, limit: int = 50) -> list[BankTransferProof]:
    return (
        BankTransferProof.query.filter(
            BankTransferProof.customer_id == customer.id,
            BankTransferProof.status.in_(BANK_TRANSFER_PROOF_OPEN_STATUSES),
        )
        .order_by(BankTransferProof.submitted_at.desc())
        .limit(limit)
        .all()
    )


def list_pending_customer_proofs(customer: User, limit: int = 50) -> list[BankTransferProof]:
    return list_open_customer_proofs(customer, limit=limit)


def list_open_transfer_proofs(limit: int = 200) -> list[BankTransferProof]:
    return (
        BankTransferProof.query.filter(BankTransferProof.status.in_(BANK_TRANSFER_PROOF_OPEN_STATUSES))
        .order_by(BankTransferProof.submitted_at.asc())
        .limit(limit)
        .all()
    )


def list_all_transfer_proofs(limit: int = 200) -> list[BankTransferProof]:
    return (
        BankTransferProof.query.order_by(BankTransferProof.submitted_at.desc())
        .limit(limit)
        .all()
    )


def list_transfer_proofs_by_status(status: str, limit: int = 200) -> list[BankTransferProof]:
    return (
        BankTransferProof.query.filter_by(status=status)
        .order_by(BankTransferProof.submitted_at.desc())
        .limit(limit)
        .all()
    )


def list_pending_transfer_proofs(limit: int = 100) -> list[BankTransferProof]:
    return (
        BankTransferProof.query.filter_by(status="pending")
        .order_by(BankTransferProof.submitted_at.asc())
        .limit(limit)
        .all()
    )


def list_transfer_proof_history(limit: int = 200) -> list[BankTransferProof]:
    return (
        BankTransferProof.query.filter(~BankTransferProof.status.in_(BANK_TRANSFER_PROOF_OPEN_STATUSES))
        .order_by(BankTransferProof.submitted_at.desc())
        .limit(limit)
        .all()
    )


def count_open_transfer_proofs() -> int:
    return BankTransferProof.query.filter(BankTransferProof.status.in_(BANK_TRANSFER_PROOF_OPEN_STATUSES)).count()


def count_pending_transfer_proofs() -> int:
    return BankTransferProof.query.filter_by(status="pending").count()


def get_transfer_proof(proof_id) -> BankTransferProof | None:
    import uuid

    try:
        pid = uuid.UUID(str(proof_id))
    except ValueError:
        return None
    return BankTransferProof.query.get(pid)


def proof_to_staff_dict(proof: BankTransferProof) -> dict:
    data = proof.to_dict(include_packages=True)
    if proof.customer:
        data["customer_name"] = proof.customer.full_name
        data["shipping_id"] = proof.customer.shipping_id
    return data


def mark_transfer_proof_in_progress(proof: BankTransferProof, staff_user: User) -> BankTransferProof:
    if proof.status != "pending":
        raise ValueError("Only pending transfer proofs can be marked in progress")

    proof.status = "in_progress"
    proof.reviewed_at = datetime.utcnow()
    proof.reviewed_by_id = staff_user.id
    db.session.commit()
    return proof


def confirm_transfer_proof(proof: BankTransferProof, staff_user: User) -> BankTransferProof:
    if proof.status not in BANK_TRANSFER_PROOF_OPEN_STATUSES:
        raise ValueError("Only open transfer proofs can be confirmed")

    package_ids = [str(link.package_id) for link in proof.package_links if link.package_id]
    if package_ids:
        from app.services.payment_service import record_payment_checkout

        record_payment_checkout(
            proof.customer,
            package_ids,
            method="bank_transfer",
            recorded_by=staff_user,
            reference=proof.transfer_reference,
            notes=proof.notes,
        )

    proof.status = "confirmed"
    proof.reviewed_at = datetime.utcnow()
    proof.reviewed_by_id = staff_user.id
    db.session.commit()
    return proof


def reject_transfer_proof(proof: BankTransferProof, staff_user: User) -> BankTransferProof:
    if proof.status not in BANK_TRANSFER_PROOF_OPEN_STATUSES:
        raise ValueError("Only open transfer proofs can be rejected")

    proof.status = "rejected"
    proof.reviewed_at = datetime.utcnow()
    proof.reviewed_by_id = staff_user.id
    db.session.commit()
    return proof


def _validate_proof_packages(customer: User, package_ids: list) -> list[Package]:
    if not package_ids:
        return []

    if len(package_ids) > 50:
        raise ValueError("Cannot link more than 50 packages to one transfer proof")

    packages: list[Package] = []
    seen: set[str] = set()

    for raw_id in package_ids:
        pid = str(raw_id)
        if pid in seen:
            continue
        seen.add(pid)

        package = Package.query.filter_by(id=raw_id, customer_id=customer.id).first()
        if not package:
            raise ValueError("One or more packages were not found on your account")
        if package.billing_status == "paid":
            raise ValueError(f"{package.tracking_number} is already paid")
        if package.status != PAYMENT_ELIGIBLE_STATUS or package.billing_status != "ready":
            raise ValueError(
                f"{package.tracking_number} is not ready for payment yet"
            )
        packages.append(package)

    return packages


def submit_bank_transfer_proof(
    customer: User,
    *,
    proof_object_key: str,
    package_ids: list | None = None,
    transfer_reference: str | None = None,
    amount_jmd=None,
    notes: str | None = None,
) -> BankTransferProof:
    proof_key = (proof_object_key or "").strip()
    if not proof_key:
        raise ValueError("proof_object_key is required")
    if not is_valid_transfer_proof_reference(proof_key):
        raise ValueError("Invalid transfer proof file reference")

    packages = _validate_proof_packages(customer, package_ids or [])

    amount = _decimal(amount_jmd)
    if amount is not None and amount <= 0:
        raise ValueError("amount_jmd must be greater than zero")

    if packages:
        expected = compute_payment_total_with_delivery(customer, [str(p.id) for p in packages])
        expected_total = Decimal(str(expected["total_jmd"]))
        if amount is None:
            amount = expected_total
        elif amount != expected_total:
            raise ValueError(
                f"amount_jmd must match the total due ({float(expected_total):.2f} JMD including delivery fee if applicable)"
            )

    reference = (transfer_reference or "").strip() or None
    note_text = (notes or "").strip() or None
    if note_text and len(note_text) > 500:
        raise ValueError("notes must be 500 characters or fewer")

    proof = BankTransferProof(
        customer_id=customer.id,
        proof_object_key=proof_key,
        transfer_reference=reference,
        amount_jmd=amount,
        notes=note_text,
        status="pending",
        submitted_at=datetime.utcnow(),
    )
    db.session.add(proof)
    db.session.flush()

    for package in packages:
        db.session.add(
            BankTransferProofPackage(
                proof_id=proof.id,
                package_id=package.id,
            )
        )

    db.session.commit()
    return proof
