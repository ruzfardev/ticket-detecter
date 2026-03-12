import time
import requests
import jwt

BASE_URL = "https://eticket.railway.uz"

_username: str = ""
_password: str = ""
_access_token: str = ""
_refresh_token: str = ""
_csrf_token: str = ""
_cookie_str: str = ""

COMMON_HEADERS = {
    "Origin": BASE_URL,
    "Referer": f"{BASE_URL}/uz/auth/login",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "uz",
    "device-type": "BROWSER",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
}


def init(username: str, password: str):
    global _username, _password
    _username = username
    _password = password


def _is_expired(token: str, buffer_seconds: int = 60) -> bool:
    try:
        payload = jwt.decode(token, options={"verify_signature": False})
        return time.time() >= (payload.get("exp", 0) - buffer_seconds)
    except Exception:
        return True


def _get_csrf() -> tuple[str, str]:
    """Returns (csrf_token_value, cookie_header_string)"""
    resp = requests.get(
        f"{BASE_URL}/api/v1/csrf-token",
        headers=COMMON_HEADERS,
        timeout=15,
    )
    resp.raise_for_status()

    csrf_value = None
    cookie_parts = []
    for cookie in resp.cookies:
        cookie_parts.append(f"{cookie.name}={cookie.value}")
        if cookie.name == "XSRF-TOKEN":
            csrf_value = cookie.value

    if not csrf_value:
        raise RuntimeError("XSRF-TOKEN cookie not found in /api/v1/csrf-token response")

    return csrf_value, "; ".join(cookie_parts)


def _login() -> bool:
    global _access_token, _refresh_token, _csrf_token, _cookie_str

    csrf_value, cookie_str = _get_csrf()

    resp = requests.post(
        f"{BASE_URL}/api/v1/auth/login",
        json={"username": _username, "password": _password},
        headers={
            **COMMON_HEADERS,
            "Content-Type": "application/json",
            "X-XSRF-TOKEN": csrf_value,
            "Cookie": cookie_str,
        },
        timeout=15,
    )

    if resp.status_code != 200:
        print(f"[auth] Login failed: {resp.status_code} {resp.text[:200]}")
        return False

    data = resp.json()
    _access_token = data.get("token", "")
    _refresh_token = data.get("refreshToken", "")
    _csrf_token = csrf_value

    # Merge login response cookies with csrf cookies
    all_cookies = dict(item.split("=", 1) for item in cookie_str.split("; ") if "=" in item)
    for cookie in resp.cookies:
        all_cookies[cookie.name] = cookie.value
    _cookie_str = "; ".join(f"{k}={v}" for k, v in all_cookies.items())

    print("[auth] Login successful.")
    return bool(_access_token)


def get_auth_headers() -> dict:
    global _access_token

    if not _access_token or _is_expired(_access_token):
        print("[auth] Token expired, re-logging in...")
        if not _login():
            raise RuntimeError("Authentication failed. Check RAILWAY_USERNAME/PASSWORD in .env.")

    return {
        **COMMON_HEADERS,
        "Content-Type": "application/json",
        "Authorization": f"Bearer {_access_token}",
        "X-XSRF-TOKEN": _csrf_token,
        "Cookie": _cookie_str,
    }
