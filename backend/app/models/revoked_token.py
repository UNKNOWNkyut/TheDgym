from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, String

from app.database import Base


class RevokedToken(Base):
    """Durable store for explicitly logged-out or single-use JWT IDs across restarts."""

    __tablename__ = "revoked_tokens"

    jti = Column(String(64), primary_key=True, index=True)
    expires_at = Column(DateTime(timezone=True), index=True, nullable=False)
    revoked_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class RateLimitHit(Base):
    """Durable sliding-window timestamps for sensitive rate-limited endpoints."""

    __tablename__ = "rate_limit_hits"

    id = Column(Integer, primary_key=True, autoincrement=True)
    bucket_key = Column(String(160), index=True, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
        nullable=False,
    )
