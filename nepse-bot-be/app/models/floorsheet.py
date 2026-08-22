"""
Floorsheet Model — aligned with Supabase `floorsheet` table.
Uses UUID primary key.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Date, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.database import Base


class Floorsheet(Base):
    __tablename__ = "floorsheet"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    stock_id = Column(UUID(as_uuid=True), ForeignKey("stocks.id", ondelete="CASCADE"), nullable=False, index=True)
    trade_date = Column(Date, nullable=False, index=True)
    trade_time = Column(DateTime(timezone=True))
    contract_id = Column(String(50), unique=True, index=True)
    buyer_broker_id = Column(String(20), nullable=False, index=True)
    buyer_broker_name = Column(String(200))
    seller_broker_id = Column(String(20), nullable=False, index=True)
    seller_broker_name = Column(String(200))
    quantity = Column(Float, nullable=False)
    rate = Column(Float, nullable=False)
    amount = Column(Float, nullable=False)
    is_institutional = Column(Integer, default=0)
    is_cross_trade = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    stock = relationship("Stock", back_populates="floorsheet")

    __table_args__ = (
        Index('idx_floorsheet_stock', 'stock_id'),
        Index('idx_floorsheet_date', 'trade_date'),
        Index('idx_floorsheet_buyer', 'buyer_broker_id'),
        Index('idx_floorsheet_seller', 'seller_broker_id'),
    )

    def __repr__(self):
        return f"<Floorsheet(stock_id={self.stock_id}, date={self.trade_date}, buyer={self.buyer_broker_id}, seller={self.seller_broker_id})>"

    def to_dict(self, include_stock=False):
        data = {
            "id": str(self.id),
            "stock_id": str(self.stock_id),
            "trade_date": self.trade_date.isoformat() if self.trade_date else None,
            "trade_time": self.trade_time.isoformat() if self.trade_time else None,
            "contract_id": self.contract_id,
            "buyer_broker_id": self.buyer_broker_id,
            "buyer_broker_name": self.buyer_broker_name,
            "seller_broker_id": self.seller_broker_id,
            "seller_broker_name": self.seller_broker_name,
            "quantity": self.quantity,
            "rate": self.rate,
            "amount": self.amount,
            "is_institutional": self.is_institutional,
            "is_cross_trade": self.is_cross_trade,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_stock and self.stock:
            data["stock"] = {"symbol": self.stock.symbol, "name": self.stock.name}
        return data
