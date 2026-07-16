import uuid
from datetime import date, datetime

from app.extensions import db
from app.models.package import Package
from app.models.receive_batch import ReceiveBatch
from app.models.user import User


def _next_batch_code(receive_date: date) -> str:
    prefix = receive_date.strftime("%m%d")
    pattern = f"RB-{prefix}-%"
    count = (
        ReceiveBatch.query.filter(ReceiveBatch.batch_code.like(pattern)).count()
    )
    return f"RB-{prefix}-{count + 1:02d}"


def create_receive_batch(
    *,
    reference: str | None = None,
    receive_date: date | None = None,
    note: str | None = None,
    created_by: User | None = None,
) -> ReceiveBatch:
    receive_date = receive_date or date.today()
    batch_code = _next_batch_code(receive_date)
    label = (reference or "").strip() or batch_code

    batch = ReceiveBatch(
        batch_code=batch_code,
        reference=label,
        receive_date=receive_date,
        status="open",
        note=note.strip() if note else None,
        created_by_id=created_by.id if created_by else None,
    )
    db.session.add(batch)
    db.session.commit()
    return batch


def list_receive_batches(
    *,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[ReceiveBatch], int]:
    query = ReceiveBatch.query
    if status:
        query = query.filter(ReceiveBatch.status == status)
    query = query.order_by(ReceiveBatch.receive_date.desc(), ReceiveBatch.created_at.desc())
    total = query.count()
    batches = query.offset(offset).limit(limit).all()
    return batches, total


def get_receive_batch(batch_id: uuid.UUID) -> ReceiveBatch | None:
    return db.session.get(ReceiveBatch, batch_id)


def assert_open_receive_batch(batch: ReceiveBatch) -> None:
    if batch.status != "open":
        raise ValueError(f"Receive batch {batch.batch_code} is closed")


def assign_package_to_receive_batch(package: Package, batch: ReceiveBatch) -> None:
    assert_open_receive_batch(batch)
    package.receive_batch_id = batch.id
    package.updated_at = datetime.utcnow()


def resolve_receive_batch_id(raw_id: str | None) -> ReceiveBatch | None:
    if not raw_id:
        return None
    try:
        batch_id = uuid.UUID(str(raw_id))
    except (TypeError, ValueError):
        raise ValueError("Invalid receive_batch_id")
    batch = get_receive_batch(batch_id)
    if not batch:
        raise ValueError("Receive batch not found")
    assert_open_receive_batch(batch)
    return batch
