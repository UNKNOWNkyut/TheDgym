from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class UserBiometric(Base):
    """Stores persistent client-extracted face descriptors and masked ID verification metadata."""

    __tablename__ = "user_biometrics"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    face_descriptor_json = Column(Text, nullable=False)
    descriptor_version = Column(String(32), default="faceapi-128-v1", nullable=False)

    id_type = Column(String(50), nullable=True)
    id_number_masked = Column(String(32), nullable=True)
    id_number_hash = Column(String(64), index=True, nullable=True)
    id_ocr_name = Column(String(255), nullable=True)
    id_face_match_score = Column(Float, nullable=True)
    reference_selfie_b64 = Column(Text, nullable=True)
    verification_provider = Column(String(32), default="faceapi_local", nullable=False)

    is_enrolled = Column(Boolean, default=True, nullable=False)
    enrolled_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    last_verified_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = relationship("User", lazy="selectin")

    def __repr__(self) -> str:
        return f"<UserBiometric(id={self.id}, user_id={self.user_id}, enrolled={self.is_enrolled})>"
