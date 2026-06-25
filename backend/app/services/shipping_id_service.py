import re

from flask import current_app

from app.extensions import db


def generate_shipping_id() -> str:
    from app.models.user import User

    start = current_app.config.get("BOSS_ID_SEQ_START", 90001)
    users = User.query.filter(User.shipping_id.like("BOSS-%")).all()
    max_seq = start - 1
    for user in users:
        match = re.match(r"BOSS-(\d+)$", user.shipping_id)
        if match:
            max_seq = max(max_seq, int(match.group(1)))
    return f"BOSS-{max_seq + 1:05d}"
