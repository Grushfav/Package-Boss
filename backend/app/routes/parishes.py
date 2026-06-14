from flask import Blueprint, jsonify

from app.constants import JAMAICA_PARISHES

parishes_bp = Blueprint("parishes", __name__)


@parishes_bp.route("/parishes", methods=["GET"])
def list_parishes():
    return jsonify({"parishes": JAMAICA_PARISHES})
