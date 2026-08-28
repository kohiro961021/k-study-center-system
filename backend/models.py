from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime, timezone

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=True)  # nullable for Google-only users
    is_admin = Column(Boolean, default=False)
    name = Column(String, nullable=True)  # 學生姓名（出席名單用）
    email = Column(String, nullable=True)  # Google 信箱
    google_id = Column(String, nullable=True, unique=True)  # Google OAuth ID
    
    # Banning fields
    is_banned = Column(Boolean, default=False)
    banned_until = Column(DateTime, nullable=True)
    ban_reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    reservations = relationship("Reservation", back_populates="user")


class SystemConfig(Base):
    __tablename__ = "system_configs"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(String, nullable=False)  # JSON formatted string



class Seat(Base):
    __tablename__ = "seats"

    id = Column(Integer, primary_key=True, index=True)
    label = Column(String, unique=True, nullable=False)  # 顯示用標籤 (即座位號碼字串)
    seat_number = Column(Integer, unique=True, nullable=False)  # 座位編號
    zone = Column(String, nullable=False)  # 區域: "新1(315)", "舊館主區" 等
    building = Column(String, nullable=False)  # "新館" or "舊館"
    seat_type = Column(String, default="normal")  # normal, staff, pillar
    note = Column(String, nullable=True)  # 管理員註記
    status = Column(String, default="available")  # available, maintenance

    reservations = relationship("Reservation", back_populates="seat")


class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    seat_id = Column(Integer, ForeignKey("seats.id"), nullable=False)
    res_date = Column(String, nullable=False, index=True)  # Format: YYYY-MM-DD
    attendance_status = Column(String, nullable=True)  # null=未點名, "present"=有到, "absent"=未到
    check_in_time = Column(DateTime, nullable=True)  # QR Code 簽到時間
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="reservations")
    seat = relationship("Seat", back_populates="reservations")

    __table_args__ = (
        # 同一天同一座位只能被預約一次
        UniqueConstraint('res_date', 'seat_id', name='uq_reservation_seat_date'),
        # 同一天同一人只能預約一個座位
        UniqueConstraint('res_date', 'user_id', name='uq_reservation_user_date'),
    )


class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    content = Column(String, nullable=False)  # Markdown content
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_pinned = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    author = relationship("User")


class BuildingDateOverride(Base):
    __tablename__ = "building_date_overrides"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(String, nullable=False, index=True)  # Format: YYYY-MM-DD
    building = Column(String, nullable=False)           # "新館" or "舊館"
    status = Column(String, nullable=False)             # "open" or "closed"

    __table_args__ = (
        UniqueConstraint('date', 'building', name='uq_override_date_building'),
    )
