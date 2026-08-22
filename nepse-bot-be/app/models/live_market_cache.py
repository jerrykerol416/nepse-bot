"""
Live Market Cache — aligned with Supabase `live_market_cache` table.
Uses UUID primary key.
"""

from sqlalchemy import Column, String, Float, DateTime, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


class LiveMarketCache(Base):
    __tablename__ = "live_market_cache"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    symbol = Column(String(20), nullable=False, unique=True, index=True)
    ltp = Column(Float)
    open_price = Column(Float)
    high_price = Column(Float)
    low_price = Column(Float)
    previous_close = Column(Float)
    percent_change = Column(Float)
    volume = Column(Float)
    turnover = Column(Float)
    source = Column(String(40))
    scraped_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_lmc_scraped_at", "scraped_at"),
    )

    def __repr__(self):
        return f"<LiveMarketCache({self.symbol} ltp={self.ltp} src={self.source})>"
