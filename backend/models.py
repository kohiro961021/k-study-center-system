from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, unique=True, index=True, nullable=False)  # Student ID or Admin Username
    password_hash = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False)

    reservations = relationship("Reservation", back_populates="user")

class Seat(Base):
    __tablename__ = "seats"

    id = Column(Integer, primary_key=True, index=True)
    label = Column(String, unique=True, nullable=False)  # e.g., "A1", "B2"
    x = Column(Integer, nullable=False)
    y = Column(Integer, nullable=False)
    status = Column(String, default="available")  # available, maintenance

    reservations = relationship("Reservation", back_populates="seat")

class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    seat_id = Column(Integer, ForeignKey("seats.id"), nullable=False)
    res_date = Column(String, nullable=False)  # Format: YYYY-MM-DD
    timeslot = Column(String, nullable=False)  # e.g., "17:00-21:00"
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="reservations")
    seat = relationship("Seat", back_populates="reservations")

    __table_args__ = (
        # Constraint 1: Prevent duplicate booking for same seat at same time
        UniqueConstraint('res_date', 'timeslot', 'seat_id', name='uq_reservation_seat_time'),
        # Constraint 2: Prevent same user booking multiple seats at same time
        UniqueConstraint('res_date', 'timeslot', 'user_id', name='uq_reservation_user_time'),
    )
