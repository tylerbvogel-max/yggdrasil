"""Security headers middleware.

Adds standard security headers to all responses for defense-in-depth.

Addresses: NIST 800-53 AC-12, SC-10, SC-28
           CMMC 3.1.11, 3.13.9
           SOC 2 CC6.1, CC6.7
           FedRAMP Moderate SC family
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Inject security headers into every response."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        # Prevent MIME-type sniffing (SC-28)
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Prevent clickjacking (SC-10) — SAMEORIGIN allows inline report viewer
        response.headers["X-Frame-Options"] = "SAMEORIGIN"

        # XSS protection (legacy browsers)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Referrer policy — don't leak URL paths to external origins
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Content Security Policy — restrict resource loading
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; "
            "connect-src 'self'; "
            "font-src 'self'; "
            "frame-ancestors 'self'"
        )

        # Permissions policy — restrict browser features
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=()"
        )

        # Session timeout hint via custom header (AC-12)
        timeout_seconds = settings.session_timeout_minutes * 60
        response.headers["X-Session-Timeout"] = str(timeout_seconds)

        # HSTS — instruct browsers to use HTTPS only (SC-8)
        # Safe to set even in dev; browsers only enforce over actual HTTPS
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )

        # Cache control for sensitive responses
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Pragma"] = "no-cache"

        return response
