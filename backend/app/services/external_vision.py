"""Lightweight async REST integrations for OCR.space ID OCR and Face++ 1:1 verification."""

import base64
from dataclasses import dataclass
import logging
import re
from typing import Any, Dict, Optional, Tuple

import httpx

logger = logging.getLogger("dgym.biometrics")

OCR_SPACE_ENDPOINT = "https://api.ocr.space/parse/image"
DEFAULT_EXTERNAL_TIMEOUT_SEC = 18.0
MAX_IMAGE_BYTES = 1_500_000
_DATA_URI_RE = re.compile(
    r"^data:(image/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\s]+)$",
    re.IGNORECASE,
)
_RAW_B64_RE = re.compile(r"^[A-Za-z0-9+/=\s]+$")


@dataclass(frozen=True)
class ExternalOcrResult:
    ok: bool
    provider: str
    raw_text: str = ""
    error: str = ""


@dataclass(frozen=True)
class ExternalFaceCompareResult:
    ok: bool
    matched: bool
    provider: str
    confidence: float = 0.0
    threshold: float = 0.0
    error: str = ""
    is_service_error: bool = False


def sanitize_base64_image(raw_value: str, max_bytes: int = MAX_IMAGE_BYTES) -> Tuple[str, str]:
    """Validate a base64-encoded image string and return (data_url, raw_base64)."""
    trimmed = (raw_value or "").strip()
    if not trimmed:
        raise ValueError("Empty image payload.")

    match = _DATA_URI_RE.match(trimmed)
    if match:
        mime = match.group(1).lower().replace("image/jpg", "image/jpeg")
        raw_b64 = re.sub(r"\s+", "", match.group(2))
    elif _RAW_B64_RE.match(trimmed):
        mime = "image/jpeg"
        raw_b64 = re.sub(r"\s+", "", trimmed)
    else:
        raise ValueError("Unsupported image encoding; expected base64 JPEG, PNG, or WebP.")

    try:
        decoded = base64.b64decode(raw_b64, validate=True)
    except Exception as exc:
        raise ValueError("Malformed base64 image payload.") from exc

    if len(decoded) < 128:
        raise ValueError("Image payload is too small to contain a valid face or ID.")
    if len(decoded) > max_bytes:
        raise ValueError("Image exceeds maximum 1.5 MB upload limit.")

    normalized_b64 = base64.b64encode(decoded).decode("ascii")
    return f"data:{mime};base64,{normalized_b64}", normalized_b64


async def _post_form(
    url: str,
    *,
    data: Dict[str, Any],
    headers: Optional[Dict[str, str]] = None,
    client: Optional[httpx.AsyncClient] = None,
) -> Dict[str, Any]:
    """Send an async form POST with shared timeout/error handling."""
    if client is not None:
        response = await client.post(url, data=data, headers=headers)
        response.raise_for_status()
        return response.json()

    async with httpx.AsyncClient(timeout=DEFAULT_EXTERNAL_TIMEOUT_SEC) as own_client:
        response = await own_client.post(url, data=data, headers=headers)
        response.raise_for_status()
        return response.json()


async def extract_id_text_ocr_space(
    image_b64: str,
    api_key: str,
    *,
    client: Optional[httpx.AsyncClient] = None,
) -> ExternalOcrResult:
    """Call OCR.space Parse Image API to extract text from a Philippine ID snapshot."""
    cleaned_key = (api_key or "").strip()
    if not cleaned_key:
        return ExternalOcrResult(ok=False, provider="tesseract_local", error="OCR_SPACE_API_KEY not configured")

    try:
        data_url, _ = sanitize_base64_image(image_b64)
        payload = await _post_form(
            OCR_SPACE_ENDPOINT,
            headers={"apikey": cleaned_key},
            data={
                "base64Image": data_url,
                "language": "eng",
                "OCREngine": "2",
                "isOverlayRequired": "false",
                "scale": "true",
            },
            client=client,
        )
    except Exception as exc:
        logger.warning("OCR.space request failed: %s", exc)
        return ExternalOcrResult(ok=False, provider="ocr_space", error=str(exc))

    if payload.get("IsErroredOnProcessing"):
        err_msg = payload.get("ErrorMessage") or payload.get("ErrorDetails") or "OCR.space processing error"
        if isinstance(err_msg, list):
            err_msg = "; ".join(str(item) for item in err_msg)
        return ExternalOcrResult(ok=False, provider="ocr_space", error=str(err_msg))

    parsed_results = payload.get("ParsedResults") or []
    raw_text = "\n".join(
        str(item.get("ParsedText") or "").strip()
        for item in parsed_results
        if isinstance(item, dict) and item.get("ParsedText")
    ).strip()
    if not raw_text:
        return ExternalOcrResult(ok=False, provider="ocr_space", error="No text detected in ID image.")

    return ExternalOcrResult(ok=True, provider="ocr_space", raw_text=raw_text)


async def compare_faces_facepp(
    image1_b64: str,
    image2_b64: str,
    *,
    api_key: str,
    api_secret: str,
    base_url: str = "https://api-us.faceplusplus.com/facepp/v3",
    threshold_key: str = "1e-4",
    client: Optional[httpx.AsyncClient] = None,
) -> ExternalFaceCompareResult:
    """Compare two faces 1:1 via Face++ /compare using raw base64 JPEG/PNG payloads."""
    if not api_key or not api_secret:
        return ExternalFaceCompareResult(
            ok=False,
            matched=False,
            provider="faceapi_local",
            error="Face++ credentials not configured",
            is_service_error=True,
        )

    try:
        _, raw_1 = sanitize_base64_image(image1_b64)
        _, raw_2 = sanitize_base64_image(image2_b64)
        endpoint = f"{base_url.rstrip('/')}/compare"
        payload = await _post_form(
            endpoint,
            data={
                "api_key": api_key,
                "api_secret": api_secret,
                "image_base64_1": raw_1,
                "image_base64_2": raw_2,
            },
            client=client,
        )
    except httpx.HTTPStatusError as exc:
        body_msg = ""
        try:
            err_json = exc.response.json()
            body_msg = str(err_json.get("error_message") or "")
        except Exception:
            body_msg = str(exc)
        logger.warning("Face++ HTTP error (%s): %s", exc.response.status_code, body_msg)
        return ExternalFaceCompareResult(
            ok=False,
            matched=False,
            provider="facepp",
            error=body_msg or "Face++ API HTTP error",
            is_service_error=exc.response.status_code >= 500 or exc.response.status_code == 429,
        )
    except Exception as exc:
        logger.warning("Face++ request error: %s", exc)
        return ExternalFaceCompareResult(
            ok=False,
            matched=False,
            provider="facepp",
            error=str(exc),
            is_service_error=True,
        )

    if payload.get("error_message"):
        return ExternalFaceCompareResult(
            ok=False,
            matched=False,
            provider="facepp",
            error=str(payload["error_message"]),
            is_service_error=False,
        )

    confidence = float(payload.get("confidence") or 0.0)
    thresholds = payload.get("thresholds") or {}
    threshold = float(thresholds.get(threshold_key) or thresholds.get("1e-3") or 65.0)
    matched = confidence >= threshold and confidence > 0.0

    return ExternalFaceCompareResult(
        ok=True,
        matched=matched,
        provider="facepp",
        confidence=confidence,
        threshold=threshold,
    )
