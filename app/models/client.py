import secrets
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from app.database import Base


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)                         # ক্লায়েন্টের নাম
    api_key = Column(String, unique=True, nullable=False,          # অটো-জেনারেটেড API Key
                     default=lambda: secrets.token_urlsafe(32))
    pixel_id = Column(String, nullable=False)                      # Facebook Pixel ID
    access_token = Column(String, nullable=False)                  # CAPI Access Token
    test_event_code = Column(String, nullable=True)               # FB Test Event Code (optional)
    is_active = Column(Boolean, default=True)                      # ক্লায়েন্ট অ্যাক্টিভ কিনা
    created_at = Column(DateTime(timezone=True), server_default=func.now())
