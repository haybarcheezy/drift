"""Shared route helpers."""

from flask import abort
from marshmallow import Schema, ValidationError


def load_query_params(schema: Schema, args) -> dict:
    """Validate request query params against a schema; abort 400 on failure."""
    try:
        loaded = schema.load(args)
        if not isinstance(loaded, dict):
            abort(400, description={"validation_errors": "Invalid query params payload."})
        return loaded
    except ValidationError as err:
        abort(400, description={"validation_errors": err.messages})


def paginate(query, page: int, per_page: int):
    """Apply offset pagination and return (items, pagination_metadata)."""
    total = query.count()
    items = query.offset((page - 1) * per_page).limit(per_page).all()
    return items, {
        "page": page,
        "per_page": per_page,
        "total": total,
        "total_pages": max(1, -(-total // per_page)),  # ceiling division
    }
