"""Remove operational / test data while keeping staff accounts and rate tiers."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import func

from app.constants import UNIDENTIFIED_HOLDER_SHIPPING_ID
from app.extensions import db
from app.models.announcement import (
    Announcement,
    AnnouncementDismissal,
    AnnouncementRead,
    BroadcastJob,
)
from app.models.audit_log import AuditLog
from app.models.authorized_pickup import AuthorizedPickupPerson
from app.models.bank_transfer_proof import BankTransferProof, BankTransferProofPackage
from app.models.delivery_address import DeliveryAddress
from app.models.delivery_request import DeliveryRequest, DeliveryRequestPackage
from app.models.package import Package, PackageEvent, PackagePhoto
from app.models.password_reset_token import PasswordResetToken
from app.models.payment import PaymentCheckout, PaymentCheckoutItem
from app.models.pre_alert import PreAlert
from app.models.receive_batch import ReceiveBatch
from app.models.shipment import Shipment
from app.models.user import User


@dataclass
class ClearTestDataSummary:
    counts: dict[str, int]

    def total(self) -> int:
        return sum(self.counts.values())


def _count_rows() -> dict[str, int]:
    return {
        "payment_checkout_items": PaymentCheckoutItem.query.count(),
        "payment_checkouts": PaymentCheckout.query.count(),
        "bank_transfer_proof_packages": BankTransferProofPackage.query.count(),
        "bank_transfer_proofs": BankTransferProof.query.count(),
        "delivery_request_packages": DeliveryRequestPackage.query.count(),
        "delivery_requests": DeliveryRequest.query.count(),
        "pre_alerts": PreAlert.query.count(),
        "package_events": PackageEvent.query.count(),
        "package_photos": PackagePhoto.query.count(),
        "packages": Package.query.count(),
        "receive_batches": ReceiveBatch.query.count(),
        "shipments": Shipment.query.count(),
        "audit_logs": AuditLog.query.count(),
        "announcement_dismissals": AnnouncementDismissal.query.count(),
        "announcement_reads": AnnouncementRead.query.count(),
        "broadcast_jobs": BroadcastJob.query.count(),
        "announcements": Announcement.query.count(),
        "authorized_pickups": AuthorizedPickupPerson.query.count(),
        "delivery_addresses": DeliveryAddress.query.count(),
        "customer_accounts": User.query.filter(
            User.role == "customer",
            User.shipping_id != UNIDENTIFIED_HOLDER_SHIPPING_ID,
        ).count(),
        "staff_accounts_kept": User.query.filter(User.role.in_(("admin", "clerk"))).count(),
    }


def clear_test_data(*, include_announcements: bool = True) -> ClearTestDataSummary:
    """Delete packages, payments, requests, and customer accounts. Keeps admin/clerk users."""
    deleted: dict[str, int] = {}

    deleted["payment_checkout_items"] = (
        db.session.query(PaymentCheckoutItem).delete(synchronize_session=False)
    )
    deleted["payment_checkouts"] = (
        db.session.query(PaymentCheckout).delete(synchronize_session=False)
    )
    deleted["bank_transfer_proof_packages"] = (
        db.session.query(BankTransferProofPackage).delete(synchronize_session=False)
    )
    deleted["bank_transfer_proofs"] = (
        db.session.query(BankTransferProof).delete(synchronize_session=False)
    )
    deleted["delivery_request_packages"] = (
        db.session.query(DeliveryRequestPackage).delete(synchronize_session=False)
    )
    deleted["delivery_requests"] = (
        db.session.query(DeliveryRequest).delete(synchronize_session=False)
    )
    deleted["pre_alerts"] = db.session.query(PreAlert).delete(synchronize_session=False)
    deleted["package_events"] = db.session.query(PackageEvent).delete(synchronize_session=False)
    deleted["package_photos"] = db.session.query(PackagePhoto).delete(synchronize_session=False)
    deleted["packages"] = db.session.query(Package).delete(synchronize_session=False)
    deleted["receive_batches"] = db.session.query(ReceiveBatch).delete(synchronize_session=False)
    deleted["shipments"] = db.session.query(Shipment).delete(synchronize_session=False)
    deleted["audit_logs"] = db.session.query(AuditLog).delete(synchronize_session=False)

    if include_announcements:
        deleted["announcement_dismissals"] = (
            db.session.query(AnnouncementDismissal).delete(synchronize_session=False)
        )
        deleted["announcement_reads"] = (
            db.session.query(AnnouncementRead).delete(synchronize_session=False)
        )
        deleted["broadcast_jobs"] = db.session.query(BroadcastJob).delete(synchronize_session=False)
        deleted["announcements"] = db.session.query(Announcement).delete(synchronize_session=False)

    deleted["authorized_pickups"] = (
        db.session.query(AuthorizedPickupPerson).delete(synchronize_session=False)
    )
    deleted["delivery_addresses"] = (
        db.session.query(DeliveryAddress).delete(synchronize_session=False)
    )

    customer_ids = [
        row[0]
        for row in db.session.query(User.id)
        .filter(
            User.role == "customer",
            User.shipping_id != UNIDENTIFIED_HOLDER_SHIPPING_ID,
        )
        .all()
    ]
    if customer_ids:
        deleted["password_reset_tokens"] = (
            db.session.query(PasswordResetToken)
            .filter(PasswordResetToken.user_id.in_(customer_ids))
            .delete(synchronize_session=False)
        )
    else:
        deleted["password_reset_tokens"] = 0

    deleted["customer_accounts"] = (
        db.session.query(User)
        .filter(
            User.role == "customer",
            User.shipping_id != UNIDENTIFIED_HOLDER_SHIPPING_ID,
        )
        .delete(synchronize_session=False)
    )

    db.session.commit()
    return ClearTestDataSummary(counts=deleted)


def preview_clear_test_data() -> dict[str, int]:
    return _count_rows()
