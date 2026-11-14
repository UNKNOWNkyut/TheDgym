import hashlib
import hmac
import json
import math
from typing import Iterable, List, Optional, Sequence, Tuple

from app.config import settings
from app.models.user_biometric import UserBiometric

DESCRIPTOR_LENGTH = 128
DESCRIPTOR_VERSION = "faceapi-128-v1"

# Strict server-side Euclidean distance threshold for 128-d FaceNet/face-api descriptors.
FACE_LOGIN_MATCH_THRESHOLD = 0.55
# Slightly looser threshold for printed/aged physical ID card photos vs live selfie.
ID_SELFIE_MATCH_THRESHOLD = 0.62

SUPPORTED_ID_TYPES = frozenset(
    {
        "philsys",
        "drivers_license",
        "school_id",
        "umid",
        "passport",
        "postal_id",
        "voters_id",
        "other_gov_id",
    }
)


def validate_descriptor(values: Sequence[float]) -> List[float]:
    """Validate a 128-d face descriptor vector (finite numbers, non-zero norm)."""
    if not isinstance(values, (list, tuple)) or len(values) != DESCRIPTOR_LENGTH:
        raise ValueError(f"Face descriptor must contain exactly {DESCRIPTOR_LENGTH} values.")

    cleaned: List[float] = []
    squared_norm = 0.0
    for item in values:
        try:
            val = float(item)
        except (TypeError, ValueError) as exc:
            raise ValueError("Face descriptor contains non-numeric values.") from exc
        if not math.isfinite(val) or abs(val) > 10.0:
            raise ValueError("Face descriptor contains invalid or out-of-range values.")
        cleaned.append(val)
        squared_norm += val * val

    if math.sqrt(squared_norm) < 0.1:
        raise ValueError("Face descriptor norm is too small to represent a valid face.")
    return cleaned


def euclidean_distance(vec_a: Sequence[float], vec_b: Sequence[float]) -> float:
    """Compute Euclidean distance between two 128-d face descriptors using pure Python."""
    if len(vec_a) != DESCRIPTOR_LENGTH or len(vec_b) != DESCRIPTOR_LENGTH:
        raise ValueError("Descriptor length mismatch.")
    return math.sqrt(sum((float(a) - float(b)) ** 2 for a, b in zip(vec_a, vec_b)))


def parse_stored_descriptor(raw_json: str) -> List[float]:
    """Decode and validate a stored JSON descriptor array."""
    parsed = json.loads(raw_json)
    return validate_descriptor(parsed)


def normalize_id_type(raw_id_type: str) -> str:
    """Validate and normalize supported Philippine / school ID categories."""
    cleaned = (raw_id_type or "").strip().lower().replace("-", "_").replace(" ", "_")
    if cleaned not in SUPPORTED_ID_TYPES:
        raise ValueError("Unsupported ID type selected.")
    return cleaned


def mask_and_hash_id_number(
    raw_id_number: Optional[str],
) -> Tuple[Optional[str], Optional[str]]:
    """Return (masked_preview, keyed_hmac_hash) without retaining plaintext ID numbers."""
    if not raw_id_number:
        return None, None
    normalized = "".join(ch for ch in raw_id_number.upper().strip() if ch.isalnum())
    if not normalized:
        return None, None

    visible = normalized[-4:] if len(normalized) > 4 else normalized[-2:]
    masked = f"{'*' * max(2, len(normalized) - len(visible))}{visible}"
    digest = hmac.new(
        settings.BIOMETRIC_HMAC_SECRET.encode("utf-8"),
        normalized.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return masked, digest


def build_biometric_record(
    *,
    user_id: int,
    descriptor: Iterable[float],
    id_type: str,
    id_number: Optional[str],
    id_ocr_name: Optional[str],
    id_face_match_score: Optional[float],
    reference_selfie_b64: Optional[str] = None,
    verification_provider: str = "faceapi_local",
) -> UserBiometric:
    """Construct a UserBiometric ORM row from validated registration/enrollment inputs."""
    validated_vec = validate_descriptor(list(descriptor))
    norm_id_type = normalize_id_type(id_type)
    masked_id, hashed_id = mask_and_hash_id_number(id_number)
    ocr_name_clean = id_ocr_name.strip()[:255] if id_ocr_name and id_ocr_name.strip() else None

    return UserBiometric(
        user_id=user_id,
        face_descriptor_json=json.dumps(validated_vec, separators=(",", ":")),
        descriptor_version=DESCRIPTOR_VERSION,
        id_type=norm_id_type,
        id_number_masked=masked_id,
        id_number_hash=hashed_id,
        id_ocr_name=ocr_name_clean,
        id_face_match_score=float(id_face_match_score) if id_face_match_score is not None else None,
        reference_selfie_b64=reference_selfie_b64,
        verification_provider=verification_provider,
        is_enrolled=True,
    )
