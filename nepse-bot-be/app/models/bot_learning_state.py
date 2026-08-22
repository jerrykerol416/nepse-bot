"""
Bot Learning State Model — aligned with Supabase `bot_learning_states` table.
Uses UUID primary key.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


class BotLearningState(Base):
    __tablename__ = "bot_learning_states"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    bot_id = Column(String(50), nullable=False, unique=True, index=True)
    bot_name = Column(String(100), nullable=False)
    strategy = Column(String(50), nullable=False)
    total_trades = Column(Integer, default=0, nullable=False)
    wins = Column(Integer, default=0, nullable=False)
    losses = Column(Integer, default=0, nullable=False)
    timeouts = Column(Integer, default=0, nullable=False)
    rolling_accuracy = Column(Float, default=1.0, nullable=False)
    current_threshold = Column(Float, default=80.0, nullable=False)
    signal_weights = Column(JSON)
    sector_accuracy = Column(JSON)
    regime_accuracy = Column(JSON)
    sector_counts = Column(JSON)
    regime_counts = Column(JSON)
    mistakes_log = Column(JSON)
    last_lesson = Column(Text)
    capital_nrs = Column(Float, default=1000000.0)
    capital_deployed = Column(Float, default=0.0)
    total_pnl_nrs = Column(Float, default=0.0)
    peak_capital_nrs = Column(Float, default=1000000.0)
    max_drawdown_pct = Column(Float, default=0.0)
    last_trade_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    def to_dict(self) -> dict:
        win_rate = (self.wins / self.total_trades * 100) if self.total_trades > 0 else 0.0
        cap_nrs = self.capital_nrs or 1000000.0
        deployed = self.capital_deployed or 0.0
        pnl_nrs = self.total_pnl_nrs or 0.0
        peak = self.peak_capital_nrs or cap_nrs
        current_cap = cap_nrs + pnl_nrs
        available = max(0.0, current_cap - deployed)
        return {
            "bot_id": self.bot_id,
            "bot_name": self.bot_name,
            "strategy": self.strategy,
            "total_trades": self.total_trades,
            "wins": self.wins,
            "losses": self.losses,
            "timeouts": self.timeouts,
            "win_rate_pct": round(win_rate, 1),
            "rolling_accuracy": round(self.rolling_accuracy, 3),
            "current_threshold": round(self.current_threshold, 1),
            "signal_weights": self.signal_weights,
            "sector_accuracy": self.sector_accuracy,
            "regime_accuracy": self.regime_accuracy,
            "sector_counts": self.sector_counts,
            "regime_counts": self.regime_counts,
            "mistakes_log": self.mistakes_log or [],
            "last_lesson": self.last_lesson,
            "capital_nrs": round(cap_nrs, 0),
            "capital_deployed": round(deployed, 0),
            "capital_available": round(available, 0),
            "total_pnl_nrs": round(pnl_nrs, 0),
            "current_capital": round(current_cap, 0),
            "max_drawdown_pct": round(self.max_drawdown_pct or 0.0, 2),
            "last_trade_at": self.last_trade_at.isoformat() if self.last_trade_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
