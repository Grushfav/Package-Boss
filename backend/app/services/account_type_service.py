ACCOUNT_TYPES = ("personal", "business")


def parse_account_type_fields(data: dict) -> tuple[str, str | None]:
    """Return (account_type, company_name). Raises ValueError on invalid business signup."""
    account_type = (data.get("account_type") or "personal").strip().lower()
    if account_type not in ACCOUNT_TYPES:
        raise ValueError("account_type must be personal or business")

    company_name = (data.get("company_name") or "").strip() or None
    if account_type == "business":
        if not company_name:
            raise ValueError("Company name is required for business accounts")
        if not (data.get("trn") or "").strip():
            raise ValueError("TRN is required for business accounts")
        return account_type, company_name

    return account_type, None
