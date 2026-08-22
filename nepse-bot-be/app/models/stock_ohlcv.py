"""
Stock OHLCV Model — aligned with Supabase `stock_ohlcv` table.
Uses UUID primary key.
"""

from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.database import Base


class StockOHLCV(Base):
    __tablename__ = "stock_ohlcv"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    stock_id = Column(UUID(as_uuid=True), ForeignKey("stocks.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    open = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    low = Column(Float, nullable=False)
    close = Column(Float, nullable=False)
    volume = Column(Float, nullable=False)
    turnover = Column(Float)
    total_trades = Column(Integer)
    adjusted_close = Column(Float)
    change = Column(Float)
    change_percent = Column(Float)
    volume_ratio = Column(Float)
    body_size = Column(Float)
    upper_shadow = Column(Float)
    lower_shadow = Column(Float)
    candle_range = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    stock = relationship("Stock", back_populates="ohlcv_data")

    __table_args__ = (
        UniqueConstraint('stock_id', 'date', name='uq_stock_date'),
        Index('idx_ohlcv_stock_id', 'stock_id'),
        Index('idx_ohlcv_date', 'date'),
    )

    def __repr__(self):
        return f"<StockOHLCV(stock_id={self.stock_id}, date={self.date}, close={self.close})>"

    def to_dict(self, include_stock=False):
        data = {
            "id": str(self.id),
            "stock_id": str(self.stock_id),
            "date": self.date.isoformat() if self.date else None,
            "open": self.open, "high": self.high, "low": self.low, "close": self.close,
            "volume": self.volume, "turnover": self.turnover, "total_trades": self.total_trades,
            "adjusted_close": self.adjusted_close,
            "change": self.change, "change_percent": self.change_percent,
            "volume_ratio": self.volume_ratio,
            "body_size": self.body_size, "upper_shadow": self.upper_shadow,
            "lower_shadow": self.lower_shadow, "candle_range": self.candle_range,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_stock and self.stock:
            data["stock"] = {"symbol": self.stock.symbol, "name": self.stock.name}
        return data
