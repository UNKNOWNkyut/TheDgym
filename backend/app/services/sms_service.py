"""
Clean SMS Notification Service powered exclusively by TextBee Android Gateway
(https://textbee.dev).

Features:
- Pure TextBee Android Gateway dispatch: Routes SMS directly through Android SIM card.
- Philippine phone number normalization: Converts any format (09..., 639..., +639...) to standard E.164 (+639XXXXXXXXX).
- Asynchronous, fail-safe dispatch: SMS delivery failures never abort database transactions.
- Transactional domain templates for PT bookings, memberships, and retention vouchers.
- Live administrative health check for device status, battery level, and connectivity.
"""
import logging
import os
import re
import time
from pathlib import Path
from typing import Any, Dict, Optional

import httpx

try:
    from dotenv import load_dotenv
    _base_dir = Path(__file__).resolve().parent.parent.parent
    for _p in (Path(".env"), _base_dir / ".env", _base_dir.parent / ".env"):
        if _p.is_file():
            load_dotenv(dotenv_path=_p, override=False)
            break
except ImportError:
    pass

logger = logging.getLogger("dgym.sms")

TEXTBEE_API_BASE = "https://api.textbee.dev/api/v1/gateway"

# In-memory cache for TextBee device status to prevent redundant network calls
_cached_textbee_status: Optional[Dict[str, Any]] = None
_cached_textbee_time: float = 0.0
_ACCOUNT_CACHE_TTL_SECONDS: float = 60.0


# ──────────────────────────────────────────────────────────────────────────────
# Configuration Getters
# ──────────────────────────────────────────────────────────────────────────────

def get_textbee_api_key() -> str:
    """Returns the TextBee REST API key from environment."""
    return os.getenv("TEXTBEE_API_KEY", "").strip()


def get_textbee_device_id() -> str:
    """Returns the target Android device ID from environment."""
    return os.getenv("TEXTBEE_DEVICE_ID", "").strip()


# ──────────────────────────────────────────────────────────────────────────────
# Philippine Phone Number Normalization
# ──────────────────────────────────────────────────────────────────────────────

def _extract_ph_digits(raw_phone: Optional[str]) -> Optional[str]:
    """Helper to extract clean 11 digits starting with 09."""
    if not raw_phone or not isinstance(raw_phone, str):
        return None

    digits = re.sub(r"\D", "", raw_phone)
    if not digits:
        return None

    # Handle country codes: 639XXXXXXXXX -> 09XXXXXXXXX
    if digits.startswith("63") and len(digits) == 12:
        digits = "0" + digits[2:]
    elif digits.startswith("9") and len(digits) == 10:
        digits = "0" + digits

    if len(digits) == 11 and digits.startswith("09"):
        return digits

    return None


def normalize_ph_phone(raw_phone: Optional[str]) -> Optional[str]:
    """Returns standard 11-digit national format: '09XXXXXXXXX'."""
    return _extract_ph_digits(raw_phone)


def normalize_ph_e164(raw_phone: Optional[str]) -> Optional[str]:
    """Returns standard E.164 international format required by TextBee: '+639XXXXXXXXX'."""
    digits = _extract_ph_digits(raw_phone)
    if digits:
        return "+63" + digits[1:]
    return None


# ──────────────────────────────────────────────────────────────────────────────
# TextBee SMS Dispatcher
# ──────────────────────────────────────────────────────────────────────────────

async def send_sms(
    to_phone: str,
    message: str,
    device_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Sends an SMS message directly via the TextBee Android Gateway.
    Fails safely if unconfigured, invalid number, or gateway unreachable.
    """
    api_key = get_textbee_api_key()
    if not api_key:
        logger.info("SMS dispatch skipped: TEXTBEE_API_KEY not configured.")
        return {"status": "skipped", "provider": "textbee", "reason": "no_api_key"}

    phone_e164 = normalize_ph_e164(to_phone)
    if not phone_e164:
        logger.warning("SMS dispatch skipped: '%s' is not a valid Philippine mobile number.", to_phone)
        return {"status": "skipped", "provider": "textbee", "reason": "invalid_phone"}

    target_device = device_id or get_textbee_device_id()
    payload: Dict[str, Any] = {
        "recipients": [phone_e164],
        "message": message.strip(),
    }
    if target_device:
        payload["deviceId"] = target_device

    headers = {
        "x-api-key": api_key,
        "Content-Type": "application/json",
        "User-Agent": "TheDGym/1.0",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{TEXTBEE_API_BASE}/send-sms",
                json=payload,
                headers=headers,
            )
            if resp.status_code in (200, 201):
                logger.info("SMS queued to %s via TextBee Android Gateway.", phone_e164)
                return {"status": "sent", "provider": "textbee", "data": resp.json()}

            err_msg = resp.text
            logger.warning("TextBee SMS returned HTTP %s: %s", resp.status_code, err_msg)
            return {
                "status": "error",
                "provider": "textbee",
                "status_code": resp.status_code,
                "message": err_msg,
            }
    except Exception as exc:
        logger.error("TextBee dispatch exception: %s", exc)
        return {"status": "error", "provider": "textbee", "message": str(exc)}


# ──────────────────────────────────────────────────────────────────────────────
# Gateway Health Check & Status
# ──────────────────────────────────────────────────────────────────────────────

async def get_sms_account_status(force_refresh: bool = False) -> Dict[str, Any]:
    """
    Fetches real-time status of the TextBee Android Gateway.
    Cached for 60 seconds to avoid unnecessary external HTTP calls.
    """
    global _cached_textbee_status, _cached_textbee_time
    api_key = get_textbee_api_key()
    if not api_key:
        return {
            "configured": False,
            "provider": "textbee",
            "status": "unconfigured",
            "message": "TEXTBEE_API_KEY is not set in backend .env",
        }

    now = time.time()
    if not force_refresh and _cached_textbee_status and (now - _cached_textbee_time < _ACCOUNT_CACHE_TTL_SECONDS):
        return _cached_textbee_status

    headers = {"x-api-key": api_key, "User-Agent": "TheDGym/1.0"}
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(f"{TEXTBEE_API_BASE}/devices", headers=headers)
            if resp.status_code == 200:
                devices = resp.json().get("data", [])
                target_id = get_textbee_device_id()
                active_device = None

                for d in devices:
                    if target_id and d.get("_id") == target_id:
                        active_device = d
                        break
                    if not active_device and d.get("isDefault"):
                        active_device = d

                if not active_device and devices:
                    active_device = devices[0]

                res = {
                    "configured": True,
                    "provider": "textbee",
                    "status": "online" if active_device and active_device.get("enabled") else "offline",
                    "device_count": len(devices),
                    "device_id": active_device.get("_id") if active_device else target_id,
                    "brand": active_device.get("brand") if active_device else None,
                    "model": active_device.get("model") if active_device else None,
                    "battery": active_device.get("batteryInfo", {}).get("percentage") if active_device else None,
                }
                _cached_textbee_status = res
                _cached_textbee_time = now
                return res

            return {
                "configured": True,
                "provider": "textbee",
                "status": "error",
                "status_code": resp.status_code,
                "message": resp.text,
            }
    except Exception as exc:
        if _cached_textbee_status:
            return _cached_textbee_status
        return {
            "configured": True,
            "provider": "textbee",
            "status": "error",
            "message": str(exc),
        }


# ──────────────────────────────────────────────────────────────────────────────
# Domain Event SMS Helpers (Fail-Safe)
# ──────────────────────────────────────────────────────────────────────────────

async def notify_pt_booking_status_sms(
    *,
    member_name: str,
    coach_name: str,
    session_date_str: str,
    status: str,
    reason: Optional[str] = None,
    to_phone: Optional[str] = None,
) -> Dict[str, Any]:
    """Sends SMS when a Personal Training session is approved or declined."""
    if not to_phone:
        return {"status": "skipped", "reason": "no_phone"}

    if status.lower() == "confirmed":
        msg = (
            f"The DGym Alert: Hello {member_name}! Your 1-on-1 PT session with "
            f"Coach {coach_name} on {session_date_str} has been APPROVED. "
            f"See you at The DGym Rosario Batangas!"
        )
    elif status.lower() == "rejected":
        reason_txt = f" Reason: {reason}" if reason else ""
        msg = (
            f"The DGym Alert: Hello {member_name}, your PT booking with "
            f"Coach {coach_name} on {session_date_str} was not approved.{reason_txt} "
            f"Please rebook via the DGym member portal."
        )
    else:
        return {"status": "skipped", "reason": "unhandled_status"}

    return await send_sms(to_phone, msg)


async def notify_membership_activated_sms(
    *,
    member_name: str,
    plan_name: str,
    member_code: str,
    to_phone: Optional[str] = None,
) -> Dict[str, Any]:
    """Sends Welcome SMS upon new membership payment and activation."""
    if not to_phone:
        return {"status": "skipped", "reason": "no_phone"}

    msg = (
        f"Welcome to The DGym Rosario Batangas, {member_name}! "
        f"Your {plan_name} membership is now ACTIVE. "
        f"Member Code: {member_code}. Use your smart keycard to tap in at the front desk!"
    )
    return await send_sms(to_phone, msg)


async def notify_retention_offer_sms(
    *,
    member_name: str,
    offer_title: str,
    offer_message: str,
    to_phone: Optional[str] = None,
) -> Dict[str, Any]:
    """Sends SMS promo voucher to at-risk members for churn prevention."""
    if not to_phone:
        return {"status": "skipped", "reason": "no_phone"}

    msg = (
        f"The DGym Special Offer for {member_name}: {offer_title}! "
        f"{offer_message} Visit us at Rosario, Batangas or open your DGym app."
    )
    return await send_sms(to_phone, msg)
