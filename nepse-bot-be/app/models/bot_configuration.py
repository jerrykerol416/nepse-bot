"""
Bot Configuration Model — aligned with Supabase `bot_configs` table.
Uses UUID primary key and all nullable columns for Python backend extensions.
"""

from sqlalchemy import Column, String, Float, Boolean, DateTime, JSON, Text, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


class BotConfiguration(Base):
    __tablename__ = "bot_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    name = Column(String(100), nullable=False, unique=True, index=True)
    strategy = Column(String(50), nullable=False)
    budget = Column(Float, nullable=False, default=100000)
    available_cash = Column(Float, nullable=False, default=100000)
    is_active = Column(Boolean, default=True, nullable=False)
    parameters = Column(JSON, nullable=False, default={})
    total_pnl = Column(Float, nullable=False, default=0)
    win_count = Column(Integer, nullable=False, default=0)
    loss_count = Column(Integer, nullable=False, default=0)

    # Python backend extension columns (all nullable)
    description = Column(Text)
    sector_identifier_enabled = Column(Boolean, default=True)
    liquidity_hunter_enabled = Column(Boolean, default=True)
    market_depth_enabled = Column(Boolean, default=True)
    floorsheet_enabled = Column(Boolean, default=True)
    fundamental_enabled = Column(Boolean, default=False)
    sector_comparison_days = Column(Integer, default=30)
    sector_momentum_threshold = Column(Float, default=0.05)
    min_beta = Column(Float, default=0.8)
    max_beta = Column(Float, default=1.5)
    volume_days = Column(Integer, default=10)
    volume_threshold = Column(Float, default=1.5)
    min_volatility = Column(Float, default=0.01)
    max_volatility = Column(Float, default=0.05)
    demand_zone_lookback = Column(Integer, default=20)
    volume_spike_threshold = Column(Float, default=2.0)
    rsi_oversold = Column(Float, default=30.0)
    rsi_overbought = Column(Float, default=70.0)
    support_resistance_strength = Column(Integer, default=3)
    breakout_volume_threshold = Column(Float, default=1.5)
    pattern_lookback_days = Column(Integer, default=60)
    order_imbalance_threshold = Column(Float, default=0.3)
    bid_wall_threshold = Column(Float, default=100000.0)
    liquidity_score_threshold = Column(Float, default=0.6)
    broker_accumulation_days = Column(Integer, default=5)
    broker_volume_threshold = Column(Float, default=50000.0)
    manipulation_detection_enabled = Column(Boolean, default=True)
    risk_per_trade = Column(Float, default=1.0)
    max_risk_per_trade = Column(Float, default=2.0)
    reward_risk_ratio = Column(Float, default=2.0)
    max_open_positions = Column(Integer, default=5)
    ema_short_period = Column(Integer, default=9)
    ema_long_period = Column(Integer, default=21)
    rsi_period = Column(Integer, default=14)
    macd_fast = Column(Integer, default=12)
    macd_slow = Column(Integer, default=26)
    macd_signal = Column(Integer, default=9)
    bollinger_period = Column(Integer, default=20)
    bollinger_std = Column(Float, default=2.0)
    atr_period = Column(Integer, default=14)
    min_confidence_score = Column(Float, default=0.6)
    component_weights = Column(JSON)
    market_data_interval = Column(Integer, default=5)
    analysis_interval = Column(Integer, default=15)
    signal_generation_interval = Column(Integer, default=15)
    additional_config = Column(JSON)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self):
        return f"<BotConfiguration(id={self.id}, name='{self.name}', active={self.is_active})>"

    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "strategy": self.strategy,
            "budget": self.budget,
            "available_cash": self.available_cash,
            "is_active": self.is_active,
            "parameters": self.parameters,
            "total_pnl": self.total_pnl,
            "win_count": self.win_count,
            "loss_count": self.loss_count,
            "description": self.description,
            "risk_per_trade": self.risk_per_trade,
            "max_risk_per_trade": self.max_risk_per_trade,
            "reward_risk_ratio": self.reward_risk_ratio,
            "max_open_positions": self.max_open_positions,
            "ema_short_period": self.ema_short_period,
            "ema_long_period": self.ema_long_period,
            "rsi_period": self.rsi_period,
            "macd_fast": self.macd_fast,
            "macd_slow": self.macd_slow,
            "macd_signal": self.macd_signal,
            "bollinger_period": self.bollinger_period,
            "bollinger_std": self.bollinger_std,
            "atr_period": self.atr_period,
            "min_confidence_score": self.min_confidence_score,
            "component_weights": self.component_weights,
            "additional_config": self.additional_config,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
