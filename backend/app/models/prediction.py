from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    Float,
    String,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    customer_id = Column(
        Integer,
        ForeignKey("members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    churn_probability = Column(Float, nullable=False)
    risk_tier = Column(String(20), nullable=False, index=True)  # HIGH, MEDIUM, LOW
    top_risk_factor_1 = Column(String(150), nullable=True)
    top_risk_factor_2 = Column(String(150), nullable=True)
    top_risk_factor_3 = Column(String(150), nullable=True)
    model_version = Column(String(50), nullable=False, default="xgboost_v1.0")
    predicted_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    member = relationship("Member", backref="churn_predictions")
