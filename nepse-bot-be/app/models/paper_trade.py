"""
Paper Trade Model — aligned with Supabase `paper_trades` table.
Uses UUID primary key and nullable extension columns for Python backend.
"""

import enum

from sqlalchemy import (
    Column, Integer, String, Float, Boolean,
    DateTime, JSON, Text, Enum as SAEnum, Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


class TradeOutcome(str, enum.Enum):
    WIN     = "WIN"
    LOSS    = "LOSS"
    TIMEOUT = "TIMEOUT"
    OPEN    = "OPEN"


class TradeDirection(str, enum.Enum):
    LONG  = "LONG"
    SHORT = "SHORT"


class PaperTrade(Base):
    __tablename__ = "paper_trades"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())

    # Edge function columns (existing)
    bot_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    action = Column(String(10), nullable=False)
    quantity = Column(Integer, nullable=False)
    entry_price = Column(Float, nullable=False)
    exit_price = Column(Float)
    stoploss = Column(Float, nullable=False)
    target = Column(Float, nullable=False)
    status = Column(String(30), nullable=False, default="open")
    pnl = Column(Float, default=0)
    reason = Column(Text)
    lesson_learned = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    closed_at = Column(DateTime(timezone=True))

    # Python backend extension columns (all nullable)
    bot_name = Column(String(100))
    strategy = Column(String(50), index=True)
    direction = Column(String(10), default="LONG")
    target_price = Column(Float)
    stop_price = Column(Float)
    entry_date = Column(DateTime(timezone=True))
    capital_allocated = Column(Float)
    shares_qty = Column(Integer)
    timeframe = Column(String(10), default="daily")
    close_price = Column(Float)
    close_date = Column(DateTime(timezone=True))
    outcome = Column(String(20), default="OPEN", index=True)
    pnl_pct = Column(Float)
    pnl_nrs = Column(Float)
    is_open = Column(Boolean, default=True, nullable=False, index=True)
    signal_score = Column(Float, default=0)
    signal_context = Column(JSON)
    mistake_analysis = Column(Text)
    regime_at_entry = Column(String(30))
    sector = Column(String(100))
    max_hold_days = Column(Integer, default=10)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_paper_trades_bot_open", "bot_id", "is_open"),
        Index("ix_paper_trades_strategy_outcome", "strategy", "outcome"),
    )

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "bot_id": str(self.bot_id),
            "bot_name": self.bot_name,
            "strategy": self.strategy,
            "symbol": self.symbol,
            "action": self.action,
            "direction": self.direction,
            "quantity": self.quantity,
            "entry_price": self.entry_price,
            "target_price": self.target_price or self.target,
            "stop_price": self.stop_price or self.stoploss,
            "entry_date": self.entry_date.isoformat() if self.entry_date else None,
            "close_price": self.close_price or self.exit_price,
            "close_date": self.close_date.isoformat() if self.close_date else None,
            "outcome": self.outcome,
            "pnl_pct": round(self.pnl_pct, 2) if self.pnl_pct is not None else None,
            "pnl_nrs": round(self.pnl_nrs, 0) if self.pnl_nrs is not None else None,
            "is_open": self.is_open,
            "signal_score": self.signal_score,
            "signal_context": self.signal_context,
            "mistake_analysis": self.mistake_analysis,
            "regime_at_entry": self.regime_at_entry,
            "sector": self.sector,
            "max_hold_days": self.max_hold_days,
            "capital_allocated": self.capital_allocated,
            "shares_qty": self.shares_qty,
            "timeframe": self.timeframe or "daily",
            "status": self.status,
            "pnl": self.pnl,
            "reason": self.reason,
            "lesson_learned": self.lesson_learned,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
