from sqlalchemy import Column, Integer, String, JSON, DateTime
from sqlalchemy.sql import func
from .database import Base

class SavedTrip(Base):
    __tablename__ = "saved_trips"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False) # Clerk User ID
    destination = Column(String, index=True, nullable=False)
    trip_data = Column(JSON, nullable=False) # Store the entire AI requested/generated itinerary
    created_at = Column(DateTime(timezone=True), server_default=func.now())
