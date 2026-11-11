"""
Unified Xendit Payment Gateway Service for The DGym Rosario Batangas.
Supports GCash, Maya, QR Ph, Credit/Debit Cards, and Direct Debit.
API Docs: https://developers.xendit.co/api-reference/
"""
import base64
import logging
import os
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

from app.models.member_membership import PaymentMethod

logger = logging.getLogger("dgym.xendit")

XENDIT_API_BASE = "https://api.xendit.co"


def get_xendit_secret_key() -> str:
    """Returns the Xendit secret API key from environment."""
    return os.getenv("XENDIT_SECRET_KEY", "").strip()


def get_xendit_webhook_token() -> str:
    """Returns the Xendit webhook verification token from environment."""
    return os.getenv("XENDIT_WEBHOOK_VERIFICATION_TOKEN", "").strip()


def _get_auth_headers() -> Dict[str, str]:
    """Generates HTTP Basic Auth header for Xendit API requests."""
    key = get_xendit_secret_key()
    if not key:
        return {}
    token = base64.b64encode(f"{key}:".encode()).decode("utf-8")
    return {
        "Authorization": f"Basic {token}",
        "Content-Type": "application/json",
        "User-Agent": "TheDGym-ROSARIO/1.0",
    }


def map_xendit_payment_method(channel: Optional[str]) -> PaymentMethod:
    """Maps Xendit payment channel string to DGym PaymentMethod enum."""
    if not channel:
        return PaymentMethod.OTHER

    c = channel.upper().strip()
    if "GCASH" in c:
        return PaymentMethod.GCASH
    if "MAYA" in c:
        return PaymentMethod.MAYA
    if "QR" in c:
        return PaymentMethod.QR_PAYMENT
    if "DEBIT" in c:
        return PaymentMethod.DEBIT_CARD
    if "CREDIT" in c or "CARD" in c:
        return PaymentMethod.CREDIT_CARD
    if "BANK" in c or "TRANSFER" in c or "DD_" in c:
        return PaymentMethod.BANK_TRANSFER
    return PaymentMethod.OTHER


async def create_xendit_invoice(
    *,
    external_id: str,
    amount: float,
    description: str,
    payer_email: Optional[str] = None,
    customer_name: Optional[str] = None,
    customer_phone: Optional[str] = None,
    success_redirect_url: Optional[str] = None,
    failure_redirect_url: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Creates a hosted checkout session / invoice on Xendit.
    Returns invoice data containing invoice_url where the customer can pay.
    """
    headers = _get_auth_headers()
    if not headers:
        logger.warning("Xendit invoice skipped: XENDIT_SECRET_KEY is not configured.")
        return {"status": "skipped", "reason": "no_secret_key"}

    payload: Dict[str, Any] = {
        "external_id": external_id,
        "amount": round(float(amount), 2),
        "description": description,
        "currency": "PHP",
    }
    if payer_email:
        payload["payer_email"] = payer_email.strip()
    if success_redirect_url:
        payload["success_redirect_url"] = success_redirect_url
    if failure_redirect_url:
        payload["failure_redirect_url"] = failure_redirect_url
    if metadata:
        payload["metadata"] = metadata

    # Customer info structure
    customer_payload: Dict[str, Any] = {}
    if customer_name:
        customer_payload["given_names"] = customer_name
    if customer_phone:
        customer_payload["mobile_number"] = customer_phone
    if payer_email:
        customer_payload["email"] = payer_email
    if customer_payload:
        payload["customer"] = customer_payload

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{XENDIT_API_BASE}/v2/invoices",
                json=payload,
                headers=headers,
            )
            if resp.status_code in (200, 201):
                data = resp.json()
                logger.info("Xendit invoice created: id=%s url=%s", data.get("id"), data.get("invoice_url"))
                return {
                    "status": "success",
                    "invoice_id": data.get("id"),
                    "external_id": data.get("external_id"),
                    "invoice_url": data.get("invoice_url"),
                    "amount": data.get("amount"),
                    "currency": data.get("currency"),
                    "invoice_status": data.get("status"),
                    "expiry_date": data.get("expiry_date"),
                    "raw": data,
                }

            err_text = resp.text
            logger.error("Xendit invoice API error HTTP %s: %s", resp.status_code, err_text)
            return {
                "status": "error",
                "status_code": resp.status_code,
                "message": err_text,
            }
    except Exception as exc:
        logger.error("Xendit create_invoice exception: %s", exc)
        return {"status": "error", "message": str(exc)}


async def get_xendit_invoice(invoice_id: str) -> Dict[str, Any]:
    """Fetches the current status and payment details of an existing Xendit invoice."""
    headers = _get_auth_headers()
    if not headers:
        return {"status": "skipped", "reason": "no_secret_key"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{XENDIT_API_BASE}/v2/invoices/{invoice_id}",
                headers=headers,
            )
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "status": "success",
                    "invoice_id": data.get("id"),
                    "external_id": data.get("external_id"),
                    "invoice_status": data.get("status"),
                    "amount": data.get("amount"),
                    "payment_method": data.get("payment_method"),
                    "payment_channel": data.get("payment_channel"),
                    "paid_at": data.get("paid_at"),
                    "raw": data,
                }
            return {
                "status": "error",
                "status_code": resp.status_code,
                "message": resp.text,
            }
    except Exception as exc:
        logger.error("Xendit get_invoice exception: %s", exc)
        return {"status": "error", "message": str(exc)}


async def get_xendit_invoice_by_external_id(external_id: str) -> Dict[str, Any]:
    """Fetches an existing Xendit invoice by external_id."""
    headers = _get_auth_headers()
    if not headers:
        return {"status": "skipped", "reason": "no_secret_key"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{XENDIT_API_BASE}/v2/invoices",
                params={"external_id": external_id},
                headers=headers,
            )
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list) and len(data) > 0:
                    inv = data[0]
                    return {
                        "status": "success",
                        "invoice_id": inv.get("id"),
                        "external_id": inv.get("external_id"),
                        "invoice_status": inv.get("status"),
                        "amount": inv.get("amount"),
                        "payment_method": inv.get("payment_method"),
                        "payment_channel": inv.get("payment_channel"),
                        "paid_at": inv.get("paid_at"),
                        "raw": inv,
                    }
                return {"status": "error", "message": "Invoice not found for external_id"}
            return {
                "status": "error",
                "status_code": resp.status_code,
                "message": resp.text,
            }
    except Exception as exc:
        logger.error("Xendit get_invoice_by_external_id exception: %s", exc)
        return {"status": "error", "message": str(exc)}

