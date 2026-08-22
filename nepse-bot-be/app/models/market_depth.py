"""
Market Depth Model — aligned with Supabase `market_depth` table.
Uses UUID primary key.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Index, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.database import Base


class MarketDepth(Base):
    __tablename__ = "market_depth"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    stock_id = Column(UUID(as_uuid=True), ForeignKey("stocks.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    ltp = Column(Float)
    buy_price_1 = Column(Float); buy_quantity_1 = Column(Float); buy_orders_1 = Column(Integer)
    buy_price_2 = Column(Float); buy_quantity_2 = Column(Float); buy_orders_2 = Column(Integer)
    buy_price_3 = Column(Float); buy_quantity_3 = Column(Float); buy_orders_3 = Column(Integer)
    buy_price_4 = Column(Float); buy_quantity_4 = Column(Float); buy_orders_4 = Column(Integer)
    buy_price_5 = Column(Float); buy_quantity_5 = Column(Float); buy_orders_5 = Column(Integer)
    sell_price_1 = Column(Float); sell_quantity_1 = Column(Float); sell_orders_1 = Column(Integer)
    sell_price_2 = Column(Float); sell_quantity_2 = Column(Float); sell_orders_2 = Column(Integer)
    sell_price_3 = Column(Float); sell_quantity_3 = Column(Float); sell_orders_3 = Column(Integer)
    sell_price_4 = Column(Float); sell_quantity_4 = Column(Float); sell_orders_4 = Column(Integer)
    sell_price_5 = Column(Float); sell_quantity_5 = Column(Float); sell_orders_5 = Column(Integer)
    total_buy_quantity = Column(Float)
    total_sell_quantity = Column(Float)
    total_buy_orders = Column(Integer)
    total_sell_orders = Column(Integer)
    order_imbalance = Column(Float)
    bid_ask_spread = Column(Float)
    bid_ask_spread_percent = Column(Float)
    liquidity_score = Column(Float)
    depth_ratio = Column(Float)
    has_bid_wall = Column(Integer, default=0)
    has_ask_wall = Column(Integer, default=0)
    raw_data = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    stock = relationship("Stock", back_populates="market_depth")

    __table_args__ = (
        Index('idx_depth_stock', 'stock_id'),
        Index('idx_depth_timestamp', 'timestamp'),
    )

    def __repr__(self):
        return f"<MarketDepth(stock_id={self.stock_id}, timestamp={self.timestamp}, imbalance={self.order_imbalance})>"

    def to_dict(self, include_stock=False):
        data = {
            "id": str(self.id),
            "stock_id": str(self.stock_id),
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "ltp": self.ltp,
            "buy_orders": [
                {"price": getattr(self, f"buy_price_{i}"), "quantity": getattr(self, f"buy_quantity_{i}"), "orders": getattr(self, f"buy_orders_{i}")}
                for i in range(1, 6)
            ],
            "sell_orders": [
                {"price": getattr(self, f"sell_price_{i}"), "quantity": getattr(self, f"sell_quantity_{i}"), "orders": getattr(self, f"sell_orders_{i}")}
                for i in range(1, 6)
            ],
            "total_buy_quantity": self.total_buy_quantity,
            "total_sell_quantity": self.total_sell_quantity,
            "order_imbalance": self.order_imbalance,
            "bid_ask_spread": self.bid_ask_spread,
            "liquidity_score": self.liquidity_score,
            "has_bid_wall": self.has_bid_wall,
            "has_ask_wall": self.has_ask_wall,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_stock and self.stock:
            data["stock"] = {"symbol": self.stock.symbol, "name": self.stock.name}
        return data
