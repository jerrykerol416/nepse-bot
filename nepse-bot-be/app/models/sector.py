"""
Sector Model — aligned with Supabase `sectors` table.
Uses UUID primary key.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.database import Base


class Sector(Base):
    __tablename__ = "sectors"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    name = Column(String(100), nullable=False, unique=True, index=True)
    code = Column(String(50), unique=True, index=True)
    description = Column(String(500))
    current_index = Column(Float)
    previous_close = Column(Float)
    change = Column(Float)
    change_percent = Column(Float)
    day_high = Column(Float)
    day_low = Column(Float)
    week_high = Column(Float)
    week_low = Column(Float)
    month_high = Column(Float)
    month_low = Column(Float)
    year_high = Column(Float)
    year_low = Column(Float)
    momentum_1d = Column(Float)
    momentum_5d = Column(Float)
    momentum_10d = Column(Float)
    momentum_20d = Column(Float)
    momentum_30d = Column(Float)
    relative_strength_1d = Column(Float)
    relative_strength_5d = Column(Float)
    relative_strength_10d = Column(Float)
    relative_strength_20d = Column(Float)
    relative_strength_30d = Column(Float)
    total_volume = Column(Float)
    total_turnover = Column(Float)
    avg_volume_10d = Column(Float)
    avg_volume_30d = Column(Float)
    total_stocks = Column(Integer)
    advancing_stocks = Column(Integer)
    declining_stocks = Column(Integer)
    unchanged_stocks = Column(Integer)
    rank = Column(Integer)
    rank_change = Column(Integer)
    last_updated = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    stocks = relationship("Stock", back_populates="sector", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_sectors_name', 'name'),
        Index('idx_sectors_code', 'code'),
        Index('idx_sectors_rank', 'rank'),
    )

    def __repr__(self):
        return f"<Sector(id={self.id}, name='{self.name}', index={self.current_index})>"

    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "code": self.code,
            "description": self.description,
            "current_index": self.current_index,
            "previous_close": self.previous_close,
            "change": self.change,
            "change_percent": self.change_percent,
            "day_high": self.day_high, "day_low": self.day_low,
            "week_high": self.week_high, "week_low": self.week_low,
            "month_high": self.month_high, "month_low": self.month_low,
            "year_high": self.year_high, "year_low": self.year_low,
            "momentum_1d": self.momentum_1d, "momentum_5d": self.momentum_5d,
            "momentum_10d": self.momentum_10d, "momentum_20d": self.momentum_20d,
            "momentum_30d": self.momentum_30d,
            "relative_strength_1d": self.relative_strength_1d,
            "relative_strength_5d": self.relative_strength_5d,
            "relative_strength_10d": self.relative_strength_10d,
            "relative_strength_20d": self.relative_strength_20d,
            "relative_strength_30d": self.relative_strength_30d,
            "total_volume": self.total_volume, "total_turnover": self.total_turnover,
            "avg_volume_10d": self.avg_volume_10d, "avg_volume_30d": self.avg_volume_30d,
            "total_stocks": self.total_stocks,
            "advancing_stocks": self.advancing_stocks,
            "declining_stocks": self.declining_stocks,
            "unchanged_stocks": self.unchanged_stocks,
            "rank": self.rank, "rank_change": self.rank_change,
            "last_updated": self.last_updated.isoformat() if self.last_updated else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
