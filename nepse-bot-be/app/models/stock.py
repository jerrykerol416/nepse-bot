"""
Stock Model — aligned with Supabase `stocks` table.
Uses UUID primary key.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.database import Base


class Stock(Base):
    __tablename__ = "stocks"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    symbol = Column(String(20), nullable=False, unique=True, index=True)
    name = Column(String(200), nullable=False)
    sector_id = Column(UUID(as_uuid=True), ForeignKey("sectors.id"), nullable=True, index=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    is_tradeable = Column(Boolean, default=True, nullable=False)
    listing_date = Column(DateTime(timezone=True))
    ltp = Column(Float)
    previous_close = Column(Float)
    open_price = Column(Float)
    high_price = Column(Float)
    low_price = Column(Float)
    change = Column(Float)
    change_percent = Column(Float)
    volume = Column(Float)
    turnover = Column(Float)
    total_trades = Column(Integer)
    week_52_high = Column(Float)
    week_52_low = Column(Float)
    week_52_high_date = Column(DateTime(timezone=True))
    week_52_low_date = Column(DateTime(timezone=True))
    market_cap = Column(Float)
    outstanding_shares = Column(Float)
    free_float = Column(Float)
    eps = Column(Float)
    pe_ratio = Column(Float)
    book_value = Column(Float)
    pb_ratio = Column(Float)
    roe = Column(Float)
    dividend_yield = Column(Float)
    beta = Column(Float)
    volatility = Column(Float)
    avg_volume_10d = Column(Float)
    avg_volume_30d = Column(Float)
    sma_20 = Column(Float)
    sma_50 = Column(Float)
    sma_200 = Column(Float)
    ema_9 = Column(Float)
    ema_21 = Column(Float)
    rsi_14 = Column(Float)
    macd = Column(Float)
    macd_signal = Column(Float)
    macd_histogram = Column(Float)
    atr_14 = Column(Float)
    bollinger_upper = Column(Float)
    bollinger_middle = Column(Float)
    bollinger_lower = Column(Float)
    support_1 = Column(Float)
    support_2 = Column(Float)
    support_3 = Column(Float)
    resistance_1 = Column(Float)
    resistance_2 = Column(Float)
    resistance_3 = Column(Float)
    passes_volume_filter = Column(Boolean, default=False, nullable=False)
    passes_beta_filter = Column(Boolean, default=False, nullable=False)
    passes_volatility_filter = Column(Boolean, default=False, nullable=False)
    in_bullish_sector = Column(Boolean, default=False, nullable=False)
    last_traded_date = Column(DateTime(timezone=True))
    indicators_updated_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    sector = relationship("Sector", back_populates="stocks")
    ohlcv_data = relationship("StockOHLCV", back_populates="stock", cascade="all, delete-orphan")
    market_depth = relationship("MarketDepth", back_populates="stock", cascade="all, delete-orphan")
    floorsheet = relationship("Floorsheet", back_populates="stock", cascade="all, delete-orphan")
    signals = relationship("Signal", back_populates="stock", cascade="all, delete-orphan")
    patterns = relationship("Pattern", back_populates="stock", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_stocks_symbol', 'symbol'),
        Index('idx_stocks_sector', 'sector_id'),
        Index('idx_stocks_active', 'is_active'),
    )

    def __repr__(self):
        return f"<Stock(id={self.id}, symbol='{self.symbol}', ltp={self.ltp})>"

    def to_dict(self, include_relationships=False):
        data = {
            "id": str(self.id),
            "symbol": self.symbol,
            "name": self.name,
            "sector_id": str(self.sector_id) if self.sector_id else None,
            "is_active": self.is_active,
            "is_tradeable": self.is_tradeable,
            "ltp": self.ltp,
            "previous_close": self.previous_close,
            "open_price": self.open_price,
            "high_price": self.high_price,
            "low_price": self.low_price,
            "change": self.change,
            "change_percent": self.change_percent,
            "volume": self.volume,
            "turnover": self.turnover,
            "total_trades": self.total_trades,
            "week_52_high": self.week_52_high,
            "week_52_low": self.week_52_low,
            "market_cap": self.market_cap,
            "eps": self.eps,
            "pe_ratio": self.pe_ratio,
            "book_value": self.book_value,
            "pb_ratio": self.pb_ratio,
            "roe": self.roe,
            "dividend_yield": self.dividend_yield,
            "beta": self.beta,
            "volatility": self.volatility,
            "avg_volume_10d": self.avg_volume_10d,
            "avg_volume_30d": self.avg_volume_30d,
            "sma_20": self.sma_20, "sma_50": self.sma_50, "sma_200": self.sma_200,
            "ema_9": self.ema_9, "ema_21": self.ema_21,
            "rsi_14": self.rsi_14,
            "macd": self.macd, "macd_signal": self.macd_signal, "macd_histogram": self.macd_histogram,
            "atr_14": self.atr_14,
            "bollinger_upper": self.bollinger_upper,
            "bollinger_middle": self.bollinger_middle,
            "bollinger_lower": self.bollinger_lower,
            "support_1": self.support_1, "support_2": self.support_2, "support_3": self.support_3,
            "resistance_1": self.resistance_1, "resistance_2": self.resistance_2, "resistance_3": self.resistance_3,
            "passes_volume_filter": self.passes_volume_filter,
            "passes_beta_filter": self.passes_beta_filter,
            "passes_volatility_filter": self.passes_volatility_filter,
            "in_bullish_sector": self.in_bullish_sector,
            "last_traded_date": self.last_traded_date.isoformat() if self.last_traded_date else None,
            "indicators_updated_at": self.indicators_updated_at.isoformat() if self.indicators_updated_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_relationships and self.sector:
            data["sector"] = self.sector.to_dict()
        return data
