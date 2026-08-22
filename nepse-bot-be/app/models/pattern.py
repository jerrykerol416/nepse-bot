"""
Pattern Model — aligned with Supabase `patterns` table.
Uses UUID primary key.
"""

import enum
from sqlalchemy import Column, Integer, String, Float, DateTime, Date, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.database import Base


class PatternType(enum.Enum):
    SUPPORT = "SUPPORT"
    RESISTANCE = "RESISTANCE"
    TREND_LINE = "TREND_LINE"
    DOUBLE_TOP = "DOUBLE_TOP"
    DOUBLE_BOTTOM = "DOUBLE_BOTTOM"
    HEAD_SHOULDERS = "HEAD_SHOULDERS"
    INVERSE_HEAD_SHOULDERS = "INVERSE_HEAD_SHOULDERS"
    TRIANGLE_ASCENDING = "TRIANGLE_ASCENDING"
    TRIANGLE_DESCENDING = "TRIANGLE_DESCENDING"
    TRIANGLE_SYMMETRICAL = "TRIANGLE_SYMMETRICAL"
    FLAG_BULLISH = "FLAG_BULLISH"
    FLAG_BEARISH = "FLAG_BEARISH"
    PENNANT = "PENNANT"
    WEDGE_RISING = "WEDGE_RISING"
    WEDGE_FALLING = "WEDGE_FALLING"
    CHANNEL_ASCENDING = "CHANNEL_ASCENDING"
    CHANNEL_DESCENDING = "CHANNEL_DESCENDING"
    BREAKOUT_BULLISH = "BREAKOUT_BULLISH"
    BREAKOUT_BEARISH = "BREAKOUT_BEARISH"


class PatternStatus(enum.Enum):
    FORMING = "FORMING"
    CONFIRMED = "CONFIRMED"
    BROKEN = "BROKEN"
    COMPLETED = "COMPLETED"


class Pattern(Base):
    __tablename__ = "patterns"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    stock_id = Column(UUID(as_uuid=True), ForeignKey("stocks.id", ondelete="CASCADE"), nullable=False, index=True)
    pattern_type = Column(String(50), nullable=False, index=True)
    status = Column(String(20), default="FORMING", nullable=False, index=True)
    pattern_name = Column(String(100), nullable=False)
    description = Column(String(500))
    level_1 = Column(Float)
    level_2 = Column(Float)
    level_3 = Column(Float)
    strength = Column(Float)
    touches = Column(Integer)
    duration_days = Column(Integer)
    breakout_price = Column(Float)
    breakout_date = Column(Date)
    breakout_volume = Column(Float)
    volume_confirmation = Column(Integer, default=0)
    target_1 = Column(Float)
    target_2 = Column(Float)
    target_3 = Column(Float)
    invalidation_level = Column(Float)
    timeframe = Column(String(20))
    first_detected = Column(Date, nullable=False, index=True)
    last_updated = Column(Date)
    confirmed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    stock = relationship("Stock", back_populates="patterns")

    __table_args__ = (
        Index('idx_patterns_stock', 'stock_id'),
        Index('idx_patterns_type', 'pattern_type'),
        Index('idx_patterns_status', 'status'),
    )

    def __repr__(self):
        return f"<Pattern(id={self.id}, stock_id={self.stock_id}, type={self.pattern_type}, status={self.status})>"

    def to_dict(self, include_stock=False):
        data = {
            "id": str(self.id),
            "stock_id": str(self.stock_id),
            "pattern_type": self.pattern_type,
            "status": self.status,
            "pattern_name": self.pattern_name,
            "description": self.description,
            "level_1": self.level_1, "level_2": self.level_2, "level_3": self.level_3,
            "strength": self.strength, "touches": self.touches, "duration_days": self.duration_days,
            "breakout_price": self.breakout_price,
            "breakout_date": self.breakout_date.isoformat() if self.breakout_date else None,
            "breakout_volume": self.breakout_volume,
            "volume_confirmation": self.volume_confirmation,
            "target_1": self.target_1, "target_2": self.target_2, "target_3": self.target_3,
            "invalidation_level": self.invalidation_level,
            "timeframe": self.timeframe,
            "first_detected": self.first_detected.isoformat() if self.first_detected else None,
            "last_updated": self.last_updated.isoformat() if self.last_updated else None,
            "confirmed_at": self.confirmed_at.isoformat() if self.confirmed_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_stock and self.stock:
            data["stock"] = {"symbol": self.stock.symbol, "name": self.stock.name}
        return data
