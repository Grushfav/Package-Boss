import uuid
from datetime import datetime

from app.extensions import db
from app.utils.datetime_format import utc_isoformat


class BankTransferProof(db.Model):
    __tablename__ = "bank_transfer_proofs"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False, index=True)
    proof_object_key = db.Column(db.String(500), nullable=False)
    transfer_reference = db.Column(db.String(100))
    sender_bank = db.Column(db.String(80))
    amount_jmd = db.Column(db.Numeric(12, 2))
    include_delivery_fee = db.Column(db.Boolean, nullable=False, default=False)
    notes = db.Column(db.String(500))
    status = db.Column(db.String(20), nullable=False, default="pending", index=True)
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    reviewed_at = db.Column(db.DateTime)
    reviewed_by_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"))

    customer = db.relationship("User", foreign_keys=[customer_id], backref="bank_transfer_proofs")
    reviewed_by = db.relationship("User", foreign_keys=[reviewed_by_id])
    package_links = db.relationship(
        "BankTransferProofPackage",
        backref="proof",
        lazy=True,
        cascade="all, delete-orphan",
    )

    def includes_delivery(self) -> bool:
        if self.include_delivery_fee:
            return True
        if self.amount_jmd is None or not self.package_links:
            return False
        from decimal import Decimal

        from app.constants import DELIVERY_FEE_JMD

        packages_total = Decimal("0")
        for link in self.package_links:
            if link.package and link.package.total_due_jmd is not None:
                packages_total += Decimal(str(link.package.total_due_jmd))
        if packages_total <= 0:
            return False
        amount = Decimal(str(self.amount_jmd))
        expected_with_delivery = packages_total + DELIVERY_FEE_JMD
        return amount >= expected_with_delivery - Decimal("0.01")

    def to_dict(self, include_packages: bool = False) -> dict:
        from app.constants import BANK_TRANSFER_PROOF_STATUS_LABELS, SENDER_BANK_LABELS
        from app.services.image_upload_service import resolve_stored_url

        data = {
            "id": str(self.id),
            "customer_id": str(self.customer_id),
            "proof_object_key": self.proof_object_key,
            "proof_url": resolve_stored_url(self.proof_object_key),
            "transfer_reference": self.transfer_reference,
            "sender_bank": self.sender_bank,
            "sender_bank_label": SENDER_BANK_LABELS.get(self.sender_bank, self.sender_bank)
            if self.sender_bank
            else None,
            "amount_jmd": float(self.amount_jmd) if self.amount_jmd is not None else None,
            "include_delivery_fee": bool(self.include_delivery_fee),
            "includes_delivery": self.includes_delivery(),
            "notes": self.notes,
            "status": self.status,
            "status_label": BANK_TRANSFER_PROOF_STATUS_LABELS.get(self.status, self.status),
            "submitted_at": utc_isoformat(self.submitted_at),
            "reviewed_at": utc_isoformat(self.reviewed_at),
            "reviewed_by_name": self.reviewed_by.full_name if self.reviewed_by else None,
        }
        if include_packages:
            data["packages"] = [link.to_dict(include_package=True) for link in self.package_links]
        else:
            data["package_count"] = len(self.package_links)
        return data


class BankTransferProofPackage(db.Model):
    __tablename__ = "bank_transfer_proof_packages"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    proof_id = db.Column(
        db.UUID(as_uuid=True),
        db.ForeignKey("bank_transfer_proofs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    package_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("packages.id"), nullable=False, index=True)

    package = db.relationship("Package", backref="bank_transfer_proof_links")

    def to_dict(self, include_package: bool = False) -> dict:
        data = {
            "id": str(self.id),
            "proof_id": str(self.proof_id),
            "package_id": str(self.package_id),
        }
        if include_package and self.package:
            data["tracking_number"] = self.package.tracking_number
            data["total_due_jmd"] = (
                float(self.package.total_due_jmd) if self.package.total_due_jmd is not None else None
            )
        return data
