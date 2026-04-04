import os
import re
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from jose import JWTError, jwt
from pydantic import BaseModel, field_validator
import redis

from models import Base, User, Seat, Reservation
from mail_service import MailService
from seat_layout import SEAT_LAYOUT

# Google Auth
try:
    from google.oauth2 import id_token as google_id_token
    from google.auth.transport import requests as google_requests
    GOOGLE_AUTH_AVAILABLE = True
except ImportError:
    GOOGLE_AUTH_AVAILABLE = False

# --- Configuration ---
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg://user:password@localhost/kstudy")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
SECRET_KEY = os.getenv("SECRET_KEY", "super_secret_key")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Rate limit config
RESERVE_RATE_LIMIT = 5          # max attempts
RESERVE_RATE_WINDOW = 60        # per N seconds

# --- Database Setup ---
engine = create_engine(DATABASE_URL)
Base.metadata.create_all(bind=engine)


def get_db():
    db = Session(bind=engine)
    try:
        yield db
    finally:
        db.close()


# --- Redis Setup ---
redis_client = redis.Redis.from_url(REDIS_URL)

# --- Security Setup ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


def verify_password(plain_password, hashed_password):
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False


def get_password_hash(password):
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        student_id: str = payload.get("sub")
        if student_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.student_id == student_id).first()
    if user is None:
        raise credentials_exception
    return user


async def get_admin_user(current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=404, detail="Not Found")
    return current_user


# --- App Initialization ---
app = FastAPI()
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)
mail_service = MailService()


# ═══════════════════
#  Date Validation
# ═══════════════════
DATE_REGEX = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def validate_date_format(date_str: str) -> str:
    """Validate date string is exactly YYYY-MM-DD and represents a real date."""
    if not DATE_REGEX.match(date_str):
        raise ValueError("日期格式必須為 YYYY-MM-DD（例如 2026-04-08）")
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise ValueError("無效的日期")
    return date_str


def is_weekend(date_str: str) -> bool:
    """Check if the given date falls on Saturday (5) or Sunday (6)."""
    d = datetime.strptime(date_str, "%Y-%m-%d").date()
    return d.weekday() in (5, 6)  # 5=Saturday, 6=Sunday


# ═══════════════════
#  Rate Limiting
# ═══════════════════
def check_rate_limit(user_id: int):
    """Sliding window rate limit: max RESERVE_RATE_LIMIT attempts per RESERVE_RATE_WINDOW seconds."""
    key = f"ratelimit:reserve:{user_id}"
    now = datetime.now(timezone.utc).timestamp()
    pipe = redis_client.pipeline()
    # Remove expired entries
    pipe.zremrangebyscore(key, 0, now - RESERVE_RATE_WINDOW)
    # Count current window
    pipe.zcard(key)
    # Add current attempt
    pipe.zadd(key, {str(now): now})
    pipe.expire(key, RESERVE_RATE_WINDOW)
    results = pipe.execute()
    count = results[1]
    if count >= RESERVE_RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"操作太頻繁，請在 {RESERVE_RATE_WINDOW} 秒後再試（每分鐘最多 {RESERVE_RATE_LIMIT} 次）"
        )


# --- Pydantic Models ---
class UserRegister(BaseModel):
    student_id: str
    password: str
    name: Optional[str] = None
    verification_code: str


class Token(BaseModel):
    access_token: str
    token_type: str


class ReservationRequest(BaseModel):
    seat_id: int
    res_date: str  # YYYY-MM-DD

    @field_validator("res_date")
    @classmethod
    def validate_res_date(cls, v):
        return validate_date_format(v)


class SendCodeRequest(BaseModel):
    student_id: str


class GoogleLoginRequest(BaseModel):
    credential: str  # Google ID Token


class SeatOut(BaseModel):
    id: int
    label: str
    seat_number: int
    zone: str
    building: str
    seat_type: str
    note: Optional[str] = None
    status: str
    model_config = {"from_attributes": True}


class ReservationOut(BaseModel):
    id: int
    user_id: int
    seat_id: int
    res_date: str
    attendance_status: Optional[str] = None
    created_at: Optional[str] = None
    model_config = {"from_attributes": True}


class AdminReservationOut(BaseModel):
    id: int
    user_id: int
    seat_id: int
    res_date: str
    student_id: str
    student_name: str
    seat_label: str
    model_config = {"from_attributes": True}


class ResetPasswordRequest(BaseModel):
    student_id: str
    new_password: str


class UserOut(BaseModel):
    id: int
    student_id: str
    name: Optional[str] = None
    is_admin: bool
    model_config = {"from_attributes": True}


class SeatNoteRequest(BaseModel):
    note: str


class SeatStatusRequest(BaseModel):
    status: str  # "maintenance" or "available"

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v not in ("maintenance", "available"):
            raise ValueError("狀態只能是 maintenance 或 available")
        return v


class AdminReserveRequest(BaseModel):
    student_id: str
    seat_id: int
    res_date: str

    @field_validator("res_date")
    @classmethod
    def validate_res_date(cls, v):
        return validate_date_format(v)


class AdminModifyReservationRequest(BaseModel):
    seat_id: Optional[int] = None
    res_date: Optional[str] = None

    @field_validator("res_date")
    @classmethod
    def validate_res_date(cls, v):
        if v is not None:
            return validate_date_format(v)
        return v


class AttendanceUpdateRequest(BaseModel):
    status: str  # "present" or "absent"


# --- Helpers ---
def check_reservation_date(res_date_str: str):
    """Validate date is within bookable range (today ~ today+7)."""
    # Format already validated by Pydantic
    now = datetime.now()
    res_date = datetime.strptime(res_date_str, "%Y-%m-%d").date()
    if not (now.date() <= res_date <= now.date() + timedelta(days=7)):
        raise HTTPException(status_code=400, detail="只能預約未來 7 天內的座位")


def check_weekend_building(res_date_str: str, seat: Seat):
    """Block new building reservations on weekends."""
    if is_weekend(res_date_str) and seat.building == "新館":
        raise HTTPException(status_code=400, detail="週六日僅開放舊館，新館不可預約")


def init_seats(db: Session):
    if db.query(Seat).count() > 0:
        return
    new_seats = []
    for s in SEAT_LAYOUT:
        new_seats.append(Seat(
            label=s["label"],
            seat_number=s["seat_number"],
            zone=s["zone"],
            building=s["building"],
            seat_type=s["seat_type"],
        ))
    db.add_all(new_seats)
    db.commit()


def _make_token(user: User) -> dict:
    access_token = create_access_token(
        data={"sub": user.student_id, "admin": user.is_admin, "name": user.name or ""}
    )
    return {"access_token": access_token, "token_type": "bearer"}


def _format_datetime(dt) -> Optional[str]:
    """Format datetime to ISO string for JSON output."""
    if dt is None:
        return None
    return dt.strftime("%Y-%m-%d %H:%M:%S")


# ═══════════════════
#  Auth Routes
# ═══════════════════

@app.post("/api/send-code")
def send_code(req: SendCodeRequest):
    mail_service.send_verification_email(req.student_id)
    return {"message": "Verification code sent"}


@app.post("/api/register")
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    if not mail_service.verify_code(user_data.student_id, user_data.verification_code):
        raise HTTPException(status_code=400, detail="驗證碼無效或已過期")
    if db.query(User).filter(User.student_id == user_data.student_id).first():
        raise HTTPException(status_code=400, detail="此學號已經註冊過了")
    hashed_pw = get_password_hash(user_data.password)
    new_user = User(
        student_id=user_data.student_id, password_hash=hashed_pw,
        name=user_data.name, email=f"{user_data.student_id}@fssh.khc.edu.tw"
    )
    db.add(new_user)
    db.commit()
    return {"message": "Registration successful"}


@app.post("/token", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.student_id == form_data.username).first()
    if not user or not user.password_hash or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="帳號或密碼錯誤")
    return _make_token(user)


@app.post("/api/auth/google", response_model=Token)
def google_login(req: GoogleLoginRequest, db: Session = Depends(get_db)):
    if not GOOGLE_AUTH_AVAILABLE:
        raise HTTPException(status_code=500, detail="Google Auth not configured")
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID not set")
    try:
        idinfo = google_id_token.verify_oauth2_token(
            req.credential, google_requests.Request(), GOOGLE_CLIENT_ID
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Google 帳號驗證失敗")

    email = idinfo.get("email", "")
    if not email.endswith("@fssh.khc.edu.tw"):
        raise HTTPException(status_code=400, detail="只允許 @fssh.khc.edu.tw 的學校信箱登入")

    google_id = idinfo.get("sub")
    name = idinfo.get("name", "")
    student_id = email.split("@")[0]

    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        user = db.query(User).filter(User.student_id == student_id).first()
        if user:
            user.google_id = google_id
            user.email = email
            if name and not user.name:
                user.name = name
            db.commit()
        else:
            user = User(student_id=student_id, google_id=google_id, email=email, name=name)
            db.add(user)
            db.commit()

    return _make_token(user)


# ═══════════════════
#  Seat Routes
# ═══════════════════

@app.get("/api/seats", response_model=List[SeatOut])
def get_seats(db: Session = Depends(get_db)):
    init_seats(db)
    return db.query(Seat).order_by(Seat.seat_number).all()


@app.get("/api/availability")
def get_availability(res_date: str, db: Session = Depends(get_db)):
    # Validate date format
    try:
        validate_date_format(res_date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    reservations = db.query(Reservation).filter(Reservation.res_date == res_date).all()
    booked_ids = [r.seat_id for r in reservations]

    # On weekends, all new building seats are unavailable
    if is_weekend(res_date):
        new_building_seats = db.query(Seat).filter(Seat.building == "新館").all()
        new_building_ids = [s.id for s in new_building_seats]
        booked_ids = list(set(booked_ids + new_building_ids))

    return booked_ids


# ═══════════════════
#  Student Routes
# ═══════════════════

@app.get("/api/my-reservations")
def get_my_reservations(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return active (cancellable) reservations only."""
    today = datetime.now().strftime("%Y-%m-%d")
    all_res = db.query(Reservation).filter(Reservation.user_id == current_user.id).all()
    result = []
    for r in all_res:
        # Active = future dates OR today with no attendance marked
        if r.res_date > today or (r.res_date == today and r.attendance_status is None):
            result.append({
                "id": r.id,
                "user_id": r.user_id,
                "seat_id": r.seat_id,
                "res_date": r.res_date,
                "attendance_status": r.attendance_status,
                "created_at": _format_datetime(r.created_at),
            })
    return result


@app.get("/api/my-history")
def get_my_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return past / non-cancellable reservations (history)."""
    today = datetime.now().strftime("%Y-%m-%d")
    all_res = db.query(Reservation).filter(Reservation.user_id == current_user.id).all()
    result = []
    for r in all_res:
        # History = past dates OR today with attendance already marked
        if r.res_date < today or (r.res_date == today and r.attendance_status is not None):
            seat = db.query(Seat).filter(Seat.id == r.seat_id).first()
            result.append({
                "id": r.id,
                "user_id": r.user_id,
                "seat_id": r.seat_id,
                "res_date": r.res_date,
                "attendance_status": r.attendance_status,
                "seat_label": seat.label if seat else f"#{r.seat_id}",
                "seat_zone": seat.zone if seat else "",
                "seat_building": seat.building if seat else "",
                "created_at": _format_datetime(r.created_at),
            })
    # Sort newest first
    result.sort(key=lambda x: x["res_date"], reverse=True)
    return result


@app.post("/api/reserve")
def create_reservation(req: ReservationRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Date format already validated by Pydantic
    check_reservation_date(req.res_date)

    # Per-user rate limiting
    check_rate_limit(current_user.id)

    seat = db.query(Seat).filter(Seat.id == req.seat_id).first()
    if not seat:
        raise HTTPException(status_code=404, detail="座位不存在")
    if seat.seat_type in ("staff", "pillar"):
        raise HTTPException(status_code=400, detail="此座位不可預約")
    if seat.status == "maintenance":
        raise HTTPException(status_code=400, detail="此座位維修中")

    # Weekend restriction
    check_weekend_building(req.res_date, seat)

    lock_key = f"lock:{req.res_date}:{req.seat_id}"
    lock = redis_client.lock(lock_key, timeout=5)
    acquired = lock.acquire(blocking=True, blocking_timeout=2)
    if not acquired:
        raise HTTPException(status_code=409, detail="此座位正在被其他人預約中，請稍後再試")

    try:
        if db.query(Reservation).filter(Reservation.res_date == req.res_date, Reservation.seat_id == req.seat_id).first():
            raise HTTPException(status_code=409, detail="此座位已被預約")
        if db.query(Reservation).filter(Reservation.res_date == req.res_date, Reservation.user_id == current_user.id).first():
            raise HTTPException(status_code=400, detail="你今天已經有預約了（一人一天限一個座位）")

        new_res = Reservation(user_id=current_user.id, seat_id=req.seat_id, res_date=req.res_date)
        db.add(new_res)
        db.commit()
        return {"message": "預約成功", "id": new_res.id}
    finally:
        lock.release()


@app.delete("/api/reservations/{reservation_id}")
def cancel_reservation(reservation_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="找不到此預約")
    if reservation.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="只能取消自己的預約")

    # Student cancellation restrictions (admin bypass)
    if not current_user.is_admin:
        today = datetime.now().strftime("%Y-%m-%d")
        # Rule 1: Cannot cancel past reservations
        if reservation.res_date < today:
            raise HTTPException(status_code=403, detail="過去日期的預約無法取消")
        # Rule 2: Cannot cancel today's reservation if already marked attendance
        if reservation.res_date == today and reservation.attendance_status is not None:
            raise HTTPException(status_code=403, detail="今日已點名的預約無法取消")

    db.delete(reservation)
    db.commit()
    return {"message": "預約已取消"}


# ═══════════════════
#  Admin Routes
# ═══════════════════

@app.get("/api/admin/users", response_model=List[UserOut])
def admin_list_users(admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    return db.query(User).filter(User.is_admin == False).all()


@app.put("/api/admin/reset-password")
def admin_reset_password(req: ResetPasswordRequest, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.student_id == req.student_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="找不到此學號")
    if user.is_admin:
        raise HTTPException(status_code=400, detail="無法重設管理員密碼")
    user.password_hash = get_password_hash(req.new_password)
    db.commit()
    return {"message": f"已成功重設 {req.student_id} 的密碼"}


@app.get("/api/admin/reservations")
def admin_list_reservations(admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    reservations = db.query(Reservation).all()
    result = []
    for r in reservations:
        user = db.query(User).filter(User.id == r.user_id).first()
        seat = db.query(Seat).filter(Seat.id == r.seat_id).first()
        result.append({
            "id": r.id, "user_id": r.user_id, "seat_id": r.seat_id,
            "res_date": r.res_date,
            "student_id": user.student_id if user else "未知",
            "student_name": (user.name if user and user.name else "未填寫"),
            "seat_label": seat.label if seat else f"#{r.seat_id}",
            "attendance_status": r.attendance_status,
            "created_at": _format_datetime(r.created_at),
            "updated_at": _format_datetime(r.updated_at),
        })
    return result


@app.delete("/api/admin/reservations/{reservation_id}")
def admin_cancel_reservation(reservation_id: int, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="找不到此預約")
    db.delete(reservation)
    db.commit()
    return {"message": "已取消該學生的預約"}


@app.put("/api/admin/seats/{seat_id}/note")
def admin_update_seat_note(seat_id: int, req: SeatNoteRequest, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    seat = db.query(Seat).filter(Seat.id == seat_id).first()
    if not seat:
        raise HTTPException(status_code=404, detail="座位不存在")
    seat.note = req.note.strip() if req.note.strip() else None
    db.commit()
    return {"message": f"已更新座位 {seat.label} 的註記"}


@app.put("/api/admin/seats/{seat_id}/status")
def admin_update_seat_status(seat_id: int, req: SeatStatusRequest, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    """Set seat to maintenance or available. When setting maintenance, cancel future reservations."""
    seat = db.query(Seat).filter(Seat.id == seat_id).first()
    if not seat:
        raise HTTPException(status_code=404, detail="座位不存在")

    old_status = seat.status
    seat.status = req.status

    cancelled_count = 0
    if req.status == "maintenance" and old_status != "maintenance":
        # Cancel all reservations for this seat from today onward
        today = datetime.now().strftime("%Y-%m-%d")
        future_reservations = db.query(Reservation).filter(
            Reservation.seat_id == seat_id,
            Reservation.res_date >= today
        ).all()
        cancelled_count = len(future_reservations)
        for r in future_reservations:
            db.delete(r)

    db.commit()

    status_text = "維修中" if req.status == "maintenance" else "可用"
    msg = f"座位 {seat.label} 已設為「{status_text}」"
    if cancelled_count > 0:
        msg += f"，已自動取消 {cancelled_count} 筆未來預約"
    return {"message": msg}


@app.post("/api/admin/reserve")
def admin_create_reservation(req: AdminReserveRequest, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.student_id == req.student_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="找不到此學號的學生")
    seat = db.query(Seat).filter(Seat.id == req.seat_id).first()
    if not seat:
        raise HTTPException(status_code=404, detail="座位不存在")

    # Weekend restriction applies to admin too
    check_weekend_building(req.res_date, seat)

    if seat.status == "maintenance":
        raise HTTPException(status_code=400, detail="此座位維修中，無法預約")

    if db.query(Reservation).filter(Reservation.res_date == req.res_date, Reservation.seat_id == req.seat_id).first():
        raise HTTPException(status_code=409, detail="此座位在該日期已被預約")
    if db.query(Reservation).filter(Reservation.res_date == req.res_date, Reservation.user_id == user.id).first():
        raise HTTPException(status_code=400, detail="該學生在該日期已有預約")
    new_res = Reservation(user_id=user.id, seat_id=req.seat_id, res_date=req.res_date)
    db.add(new_res)
    db.commit()
    return {"message": f"已成功為 {req.student_id} 預約座位 {seat.label}"}


@app.put("/api/admin/reservations/{reservation_id}")
def admin_modify_reservation(reservation_id: int, req: AdminModifyReservationRequest, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="找不到此預約")

    new_seat = req.seat_id if req.seat_id is not None else reservation.seat_id
    new_date = req.res_date if req.res_date is not None else reservation.res_date

    if db.query(Reservation).filter(Reservation.res_date == new_date, Reservation.seat_id == new_seat, Reservation.id != reservation_id).first():
        raise HTTPException(status_code=409, detail="新座位在該日期已被預約")
    if req.res_date is not None:
        if db.query(Reservation).filter(Reservation.res_date == new_date, Reservation.user_id == reservation.user_id, Reservation.id != reservation_id).first():
            raise HTTPException(status_code=400, detail="該學生在新日期已有預約")

    if req.seat_id is not None:
        reservation.seat_id = req.seat_id
    if req.res_date is not None:
        reservation.res_date = req.res_date
    # Manually touch updated_at
    reservation.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "預約已修改"}


@app.put("/api/admin/reservations/{reservation_id}/attendance")
def admin_update_attendance(reservation_id: int, req: AttendanceUpdateRequest, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    if req.status not in ("present", "absent"):
        raise HTTPException(status_code=400, detail="狀態只能是 present 或 absent")
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="找不到此預約")
    reservation.attendance_status = req.status
    reservation.updated_at = datetime.utcnow()
    db.commit()
    status_text = "有到" if req.status == "present" else "未到"
    return {"message": f"已更新出席狀態為：{status_text}"}


@app.get("/api/admin/attendance")
def admin_get_attendance(date: str, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    # Validate date format
    try:
        validate_date_format(date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    reservations = db.query(Reservation).filter(Reservation.res_date == date).all()
    result = []
    for r in reservations:
        user = db.query(User).filter(User.id == r.user_id).first()
        seat = db.query(Seat).filter(Seat.id == r.seat_id).first()
        result.append({
            "id": r.id,
            "seat_label": seat.label if seat else f"#{r.seat_id}",
            "seat_number": seat.seat_number if seat else 0,
            "zone": seat.zone if seat else "未知",
            "building": seat.building if seat else "未知",
            "student_id": user.student_id if user else "未知",
            "student_name": (user.name if user and user.name else "未填寫"),
            "attendance_status": r.attendance_status,
        })
    result.sort(key=lambda x: x["seat_number"])
    return result


@app.get("/api/admin/notes")
def admin_get_notes(admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    """取得所有有註記的座位"""
    seats_with_notes = db.query(Seat).filter(Seat.note != None, Seat.note != "").order_by(Seat.seat_number).all()
    result = []
    for s in seats_with_notes:
        result.append({
            "id": s.id,
            "seat_number": s.seat_number,
            "label": s.label,
            "zone": s.zone,
            "building": s.building,
            "note": s.note,
        })
    return result
