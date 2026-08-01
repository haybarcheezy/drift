"""Shared HTTP helpers for external baseball data APIs."""

from __future__ import annotations

import time
import urllib.error
import urllib.request
from typing import Callable

DEFAULT_UA = "PitchFlight/0.1 (+https://github.com/local; research/educational)"


def fetch_bytes(
    url: str,
    *,
    timeout: float = 120.0,
    retries: int = 3,
    backoff: float = 2.0,
    headers: dict[str, str] | None = None,
    sleeper: Callable[[float], None] = time.sleep,
) -> bytes:
    """GET url with polite retries. Raises urllib.error.URLError / HTTPError."""
    req_headers = {"User-Agent": DEFAULT_UA, "Accept": "*/*"}
    if headers:
        req_headers.update(headers)
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=req_headers)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except urllib.error.HTTPError as exc:
            last_err = exc
            # 429 / 5xx → retry; 4xx otherwise fail fast
            if exc.code in (429, 500, 502, 503, 504) and attempt < retries - 1:
                sleeper(backoff * (attempt + 1))
                continue
            raise
        except urllib.error.URLError as exc:
            last_err = exc
            if attempt < retries - 1:
                sleeper(backoff * (attempt + 1))
                continue
            raise
    assert last_err is not None
    raise last_err
