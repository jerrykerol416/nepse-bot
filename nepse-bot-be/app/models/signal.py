"""
Signal Model — aligned with Supabase `signals` table.
Uses UUID primary key.
"""

import enum
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Index, JSON, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.database import Base


class SignalType(enum.Enum):
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"


class SignalStatus(enum.Enum):
    ACTIVE = "ACTIVE"
    EXECUTED = "EXECUTED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


class Signal(Base):
    __tablename__ = "signals"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    stock_id = Column(UUID(as_uuid=True), ForeignKey("stocks.id", ondelete="CASCADE"), nullable=False, index=True)
    bot_config_id = Column(UUID(as_uuid=True), ForeignKey("bot_configs.id", ondelete="SET NULL"), nullable=True, index=True)
    signal_type = Column(String(10), nullable=False, index=True)
    status = Column(String(20), default="ACTIVE", nullable=False, index=True)
    entry_price = Column(Float, nullable=False)
    stop_loss = Column(Float, nullable=False)
    take_profit_1 = Column(Float)
    take_profit_2 = Column(Float)
    take_profit_3 = Column(Float)
    risk_amount = Column(Float)
    reward_amount = Column(Float)
    risk_reward_ratio = Column(Float)
    position_size = Column(Float)
    confidence_score = Column(Float, nullable=False, index=True)
    sector_score = Column(Float)
    liquidity_score = Column(Float)
    depth_score = Column(Float)
    floorsheet_score = Column(Float)
    technical_score = Column(Float)
    sector_bullish = Column(Integer, default=0)
    in_demand_zone = Column(Integer, default=0)
    has_volume_spike = Column(Integer, default=0)
    has_breakout = Column(Integer, default=0)
    has_bid_wall = Column(Integer, default=0)
    has_accumulation = Column(Integer, default=0)
    rsi = Column(Float)
    macd = Column(Float)
    ema_9 = Column(Float)
    ema_21 = Column(Float)
    detected_patterns = Column(JSON)
    signal_reason = Column(String(500))
    component_details = Column(JSON)
    executed_at = Column(DateTime(timezone=True))
    executed_price = Column(Float)
    exit_price = Column(Float)
    exit_at = Column(DateTime(timezone=True))
    profit_loss = Column(Float)
    profit_loss_percent = Column(Float)
    valid_until = Column(DateTime(timezone=True))
    generated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    stock = relationship("Stock", back_populates="signals")
    bot_config = relationship("BotConfiguration")

    __table_args__ = (
        Index('idx_signals_stock', 'stock_id'),
        Index('idx_signals_type', 'signal_type'),
        Index('idx_signals_status', 'status'),
        Index('idx_signals_confidence', 'confidence_score'),
    )

    def __repr__(self):
        return f"<Signal(id={self.id}, stock_id={self.stock_id}, type={self.signal_type}, confidence={self.confidence_score})>"

    def to_dict(self, include_stock=False):
        data = {
            "id": str(self.id),
            "stock_id": str(self.stock_id),
            "bot_config_id": str(self.bot_config_id) if self.bot_config_id else None,
            "signal_type": self.signal_type,
            "status": self.status,
            "entry_price": self.entry_price,
            "stop_loss": self.stop_loss,
            "take_profit_1": self.take_profit_1,
            "take_profit_2": self.take_profit_2,
            "take_profit_3": self.take_profit_3,
            "confidence_score": self.confidence_score,
            "sector_score": self.sector_score,
            "liquidity_score": self.liquidity_score,
            "depth_score": self.depth_score,
            "floorsheet_score": self.floorsheet_score,
            "technical_score": self.technical_score,
            "signal_reason": self.signal_reason,
            "component_details": self.component_details,
            "detected_patterns": self.detected_patterns,
            "generated_at": self.generated_at.isoformat() if self.generated_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_stock and self.stock:
            data["stock"] = {"symbol": self.stock.symbol, "name": self.stock.name, "ltp": self.stock.ltp}
        return data
