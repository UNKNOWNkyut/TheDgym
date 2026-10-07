import enum
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Enum, Integer, String, Text, Date
from sqlalchemy.orm import relationship

from app.database import Base


class MemberStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    EXPIRED = "expired"


class Gender(str, enum.Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"
    PREFER_NOT_TO_SAY = "prefer_not_to_say"


class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    # Auto-generated code e.g. DGM-0001
    member_code = Column(String(20), unique=True, index=True, nullable=False)

    # Personal Info
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=True)
    phone = Column(String(50), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(
        Enum(Gender, values_callable=lambda obj: [e.value for e in obj]),
        nullable=True,
    )
    address = Column(Text, nullable=True)

    # Emergency Contact
    emergency_contact_name = Column(String(255), nullable=True)
    emergency_contact_phone = Column(String(50), nullable=True)

    # Status
    status = Column(
        Enum(MemberStatus, values_callable=lambda obj: [e.value for e in obj]),
        default=MemberStatus.ACTIVE,
        nullable=False,
    )
    is_active = Column(Boolean, default=True, nullable=False)

    # Notes / Admin remarks
    notes = Column(Text, nullable=True)

    # Timestamps
    joined_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
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

    # Relationships
    memberships = relationship("MemberMembership", back_populates="member", lazy="selectin")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    def __repr__(self) -> str:
        return f"<Member(id={self.id}, code={self.member_code}, name={self.full_name})>"
