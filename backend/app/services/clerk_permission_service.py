from app.constants import (
    CLERK_PERMISSIONS,
    DEFAULT_CLERK_PERMISSIONS,
    STATUS_TRANSITIONS_BY_PERMISSION,
)
from app.models.user import User


def normalize_clerk_permissions(perms: list | None) -> list[str]:
    if not perms:
        return list(DEFAULT_CLERK_PERMISSIONS)
    return [p for p in perms if p in CLERK_PERMISSIONS]


def get_clerk_permissions(user: User) -> list[str]:
    if user.role == "admin":
        return list(CLERK_PERMISSIONS)
    if user.role != "clerk":
        return []
    return normalize_clerk_permissions(user.clerk_permissions)


def clerk_has_permission(user: User, permission: str) -> bool:
    if user.role == "admin":
        return True
    if user.role != "clerk":
        return False
    return permission in get_clerk_permissions(user)


def clerk_has_any_permission(user: User, permissions: tuple[str, ...] | list[str]) -> bool:
    if user.role == "admin":
        return True
    if user.role != "clerk":
        return False
    perms = set(get_clerk_permissions(user))
    return any(p in perms for p in permissions)


def assert_status_transition_allowed(user: User, from_status: str, to_status: str) -> None:
    if user.role == "admin":
        return
    if from_status == to_status:
        return

    if user.role != "clerk":
        raise ValueError("Clerk access required")

    allowed = set()
    user_perms = get_clerk_permissions(user)
    for perm in user_perms:
        allowed.update(STATUS_TRANSITIONS_BY_PERMISSION.get(perm, set()))

    if (from_status, to_status) not in allowed:
        raise ValueError(
            f"You are not allowed to change status from {from_status} to {to_status}"
        )


def assert_target_status_allowed(user: User, to_status: str, from_status: str | None = None) -> None:
    """For bulk updates when from_status may vary per package."""
    if user.role == "admin":
        return
    if from_status is not None:
        assert_status_transition_allowed(user, from_status, to_status)
        return

    if user.role != "clerk":
        raise ValueError("Clerk access required")

    user_perms = get_clerk_permissions(user)
    allowed_targets = set()
    for perm in user_perms:
        for _from, to in STATUS_TRANSITIONS_BY_PERMISSION.get(perm, set()):
            allowed_targets.add(to)

    if to_status not in allowed_targets:
        raise ValueError(f"You are not allowed to set status to {to_status}")
