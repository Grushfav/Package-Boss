from datetime import datetime
from decimal import Decimal

from app.constants import PAYMENT_ELIGIBLE_STATUS
from app.extensions import db
from app.models.bank_transfer_proof import BankTransferProof, BankTransferProofPackage
from app.models.package import Package
from app.models.user import User
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


def list_pending_customer_proofs(customer: User, limit: int = 50) -> list[BankTransferProof]:
    return (
        BankTransferProof.query.filter_by(customer_id=customer.id, status="pending")
        .order_by(BankTransferProof.submitted_at.desc())
        .limit(limit)
        .all()
    )


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

    if packages and amount is None:
        total = Decimal("0")
        for package in packages:
            if package.total_due_jmd is not None:
                total += package.total_due_jmd
        if total > 0:
            amount = total.quantize(Decimal("0.01"))

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
