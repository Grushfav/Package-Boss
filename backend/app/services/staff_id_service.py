import re

from app.models.user import User


def generate_staff_shipping_id() -> str:
    users = User.query.filter(User.shipping_id.like("STAFF-%")).all()
    max_seq = 0
    for user in users:
        match = re.match(r"STAFF-(\d+)$", user.shipping_id)
        if match:
            max_seq = max(max_seq, int(match.group(1)))
    return f"STAFF-{max_seq + 1:05d}"
