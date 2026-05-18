"""
Application-level exceptions with HTTP mapping.

These get caught by `app.main:app_exception_handler` and converted into
RFC 7807-style JSON responses: {"error": {"code", "message", "details"}}
"""

from __future__ import annotations

from typing import Any


class AppError(Exception):
    """Base class for all user-visible application errors."""

    code: str = "internal_error"
    status_code: int = 500

    def __init__(self, message: str = "", details: dict[str, Any] | None = None):
        super().__init__(message or self.code)
        self.message = message or self.code
        self.details = details or {}


class AuthError(AppError):
    code = "unauthorized"
    status_code = 401


class InvalidInitData(AuthError):
    code = "invalid_init_data"


class ExpiredInitData(AuthError):
    code = "expired_init_data"


class Forbidden(AppError):
    code = "forbidden"
    status_code = 403


class NotFound(AppError):
    code = "not_found"
    status_code = 404


class InvalidPayload(AppError):
    code = "invalid_payload"
    status_code = 400


class SlotLimitReached(AppError):
    code = "slot_limit_reached"
    status_code = 409


class Duplicate(AppError):
    code = "duplicate"
    status_code = 409


class RailwayUnavailable(AppError):
    code = "railway_unavailable"
    status_code = 503


class RateLimited(AppError):
    code = "rate_limited"
    status_code = 429


class UnknownPlan(AppError):
    code = "unknown_plan"
    status_code = 400


class InvalidAmount(AppError):
    code = "invalid_amount"
    status_code = 400
