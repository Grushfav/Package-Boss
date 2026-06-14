from flask import current_app


def get_warehouse_config() -> dict:
    return {
        "line1": current_app.config["WAREHOUSE_LINE1"],
        "city": current_app.config["WAREHOUSE_CITY"],
        "state": current_app.config["WAREHOUSE_STATE"],
        "zip": current_app.config["WAREHOUSE_ZIP"],
        "country": current_app.config["WAREHOUSE_COUNTRY"],
    }


def build_shipping_address(shipping_id: str) -> dict:
    warehouse = get_warehouse_config()
    formatted = (
        f"{warehouse['line1']}\n"
        f"{shipping_id}\n"
        f"{warehouse['city']}, {warehouse['state']} {warehouse['zip']}\n"
        f"United States"
    )
    return {
        **warehouse,
        "line2": shipping_id,
        "formatted": formatted,
    }
