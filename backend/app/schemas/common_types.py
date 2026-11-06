from datetime import datetime, timezone
from typing import Annotated
from pydantic import AfterValidator


def ensure_utc_datetime(value: datetime) -> datetime:
    """Attach UTC tzinfo when SQLite returns naive UTC datetimes so JSON includes 'Z'."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


UtcDatetime = Annotated[datetime, AfterValidator(ensure_utc_datetime)]
