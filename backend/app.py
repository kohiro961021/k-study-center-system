import os
from dotenv import load_dotenv
load_dotenv()
import re
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import List, Optional

TAIPEI_TZ = timezone(timedelta(hours=8))
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload, contains_eager
from sqlalchemy import create_engine, or_
from jose import JWTError, jwt
from pydantic import BaseModel, field_validator
import redis

from models import Base, User, Seat, Reservation, Announcement
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
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("❌ SECRET_KEY environment variable is required. Generate one with: openssl rand -hex 32")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
QR_TOKEN_EXPIRE_MINUTES = 3  # QR Code 有效期限（分鐘）
QR_SECRET_KEY = os.getenv("QR_SECRET_KEY", SECRET_KEY + "_qr")  # QR Token 專用密鑰

# Rate limit config
RESERVE_RATE_LIMIT = 10          # max attempts
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
        detail="無法驗證憑證，請重新登入",
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
app = FastAPI(docs_url=None, redoc_url=None)  # 生產環境關閉 API 文件


# --- Scheduler: 每日 22:00 自動標記缺席 ---
def mark_absent_job():
    """每天晚上 10 點，將今日未簽到的預約自動標記為缺席。"""
    db = Session(bind=engine)
    try:
        today = datetime.now().strftime("%Y-%m-%d")
        unmarked = db.query(Reservation).filter(
            Reservation.res_date == today,
            Reservation.attendance_status == None  # noqa: E711
        ).all()
        count = 0
        for r in unmarked:
            r.attendance_status = "absent"
            r.updated_at = datetime.now(timezone.utc)
            count += 1
        db.commit()
        print(f"[Scheduler] {today} 自動標記缺席完成，共 {count} 筆")
    except Exception as e:
        db.rollback()
        print(f"[Scheduler] 標記缺席失敗: {e}")
    finally:
        db.close()


scheduler = BackgroundScheduler(timezone="Asia/Taipei")
scheduler.add_job(
    mark_absent_job,
    CronTrigger(hour=22, minute=0, timezone="Asia/Taipei"),
    id="mark_absent_daily",
    replace_existing=True
)
scheduler.start()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://kbook.fssh.khc.edu.tw"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



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


class AdminChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str
    confirm_password: str


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


class QRScanRequest(BaseModel):
    token: str  # 學生端產生的 QR Token


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
    """Format datetime to ISO string for JSON output, converting UTC to Taipei time (+8)."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(TAIPEI_TZ).strftime("%Y-%m-%d %H:%M:%S")


# ═══════════════════
#  Auth Routes
# ═══════════════════



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
    except Exception as e:
        print(f"[Google Auth Error] {type(e).__name__}: {e}")
        raise HTTPException(status_code=400, detail="Google 帳號驗證失敗，請稍後再試")

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
    all_res = db.query(Reservation).options(
        joinedload(Reservation.seat)
    ).filter(Reservation.user_id == current_user.id).all()
    result = []
    for r in all_res:
        # History = past dates OR today with attendance already marked
        if r.res_date < today or (r.res_date == today and r.attendance_status is not None):
            seat = r.seat
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
    if seat.seat_type == "staff" or (seat.seat_type == "pillar" and seat.seat_number not in (64, 72, 77, 83)):
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


@app.put("/api/admin/change-password")
def admin_change_own_password(req: AdminChangePasswordRequest, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    """管理員修改自己的密碼，需驗證舊密碼並確認兩次新密碼一致。"""
    if not admin.password_hash or not verify_password(req.old_password, admin.password_hash):
        raise HTTPException(status_code=400, detail="舊密碼不正確")
    if req.new_password != req.confirm_password:
        raise HTTPException(status_code=400, detail="兩次輸入的新密碼不一致")
    if len(req.new_password) < 4:
        raise HTTPException(status_code=400, detail="新密碼長度至少需要 4 個字元")
    if req.old_password == req.new_password:
        raise HTTPException(status_code=400, detail="新密碼不能與舊密碼相同")
    admin.password_hash = get_password_hash(req.new_password)
    db.commit()
    return {"message": "密碼已成功修改"}


@app.get("/api/admin/reservations")
def admin_list_reservations(
    date: Optional[str] = None,
    page: int = 1,
    size: int = 20,
    search: Optional[str] = None,
    sort_by: str = "res_date",
    sort_dir: str = "desc",
    all: bool = False,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    query = db.query(Reservation).join(Reservation.user).join(Reservation.seat)

    if date:
        query = query.filter(Reservation.res_date == date)

    if search:
        search_pat = f"%{search}%"
        query = query.filter(
            or_(
                User.student_id.like(search_pat),
                User.name.like(search_pat),
                Seat.label.like(search_pat),
                Reservation.res_date.like(search_pat)
            )
        )

    sort_map = {
        "res_date": Reservation.res_date,
        "seat_label": Seat.label,
        "student_id": User.student_id,
        "student_name": User.name,
        "attendance_status": Reservation.attendance_status,
        "created_at": Reservation.created_at,
        "updated_at": Reservation.updated_at
    }
    
    sort_col = sort_map.get(sort_by, Reservation.res_date)
    
    if sort_dir == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    if date or all:
        reservations = query.options(
            contains_eager(Reservation.user),
            contains_eager(Reservation.seat)
        ).all()
        
        result = []
        for r in reservations:
            user = r.user
            seat = r.seat
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
    else:
        total_count = query.count()
        
        reservations = query.options(
            contains_eager(Reservation.user),
            contains_eager(Reservation.seat)
        ).offset((page - 1) * size).limit(size).all()
        
        items = []
        for r in reservations:
            user = r.user
            seat = r.seat
            items.append({
                "id": r.id, "user_id": r.user_id, "seat_id": r.seat_id,
                "res_date": r.res_date,
                "student_id": user.student_id if user else "未知",
                "student_name": (user.name if user and user.name else "未填寫"),
                "seat_label": seat.label if seat else f"#{r.seat_id}",
                "attendance_status": r.attendance_status,
                "created_at": _format_datetime(r.created_at),
                "updated_at": _format_datetime(r.updated_at),
            })
            
        return {
            "total": total_count,
            "page": page,
            "size": size,
            "items": items
        }


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
    reservation.updated_at = datetime.now(timezone.utc)
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
    if req.status == "present":
        if not reservation.check_in_time:
            reservation.check_in_time = datetime.now(timezone.utc)
    else:
        reservation.check_in_time = None
    reservation.updated_at = datetime.now(timezone.utc)
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

    reservations = db.query(Reservation).options(
        joinedload(Reservation.user),
        joinedload(Reservation.seat)
    ).filter(Reservation.res_date == date).all()
    result = []
    for r in reservations:
        user = r.user
        seat = r.seat
        result.append({
            "id": r.id,
            "seat_label": seat.label if seat else f"#{r.seat_id}",
            "seat_number": seat.seat_number if seat else 0,
            "zone": seat.zone if seat else "未知",
            "building": seat.building if seat else "未知",
            "student_id": user.student_id if user else "未知",
            "student_name": (user.name if user and user.name else "未填寫"),
            "attendance_status": r.attendance_status,
            "check_in_time": _format_datetime(r.check_in_time),
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


# ═══════════════════
#  QR Code 點名 Routes
# ═══════════════════

import secrets

@app.get("/api/attendance/qr")
def generate_qr_token(current_user: User = Depends(get_current_user)):
    """學生專用：產生 3 分鐘有效的 QR Code Token (Redis 短 Token)。"""
    # 產生 24 字元的安全隨機 Token
    token = secrets.token_hex(12)
    
    # 將 Token 存入 Redis，Key 為 qr_token:<token>，Value 為學號，有效時間 3 分鐘 (180 秒)
    redis_key = f"qr_token:{token}"
    redis_client.setex(redis_key, QR_TOKEN_EXPIRE_MINUTES * 60, current_user.student_id)
    
    expire = datetime.now(TAIPEI_TZ) + timedelta(minutes=QR_TOKEN_EXPIRE_MINUTES)
    return {
        "token": token,
        "expires_at": expire.isoformat(),
        "student_id": current_user.student_id,
        "name": current_user.name or "",
    }


@app.post("/api/attendance/scan")
def scan_qr_token(req: QRScanRequest, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    """管理員平板專用：驗證 Redis 短 Token 並更新簽到狀態。"""
    redis_key = f"qr_token:{req.token}"
    student_id_bytes = redis_client.get(redis_key)
    
    if not student_id_bytes:
        raise HTTPException(status_code=400, detail="QR Code 無效或已過期")
        
    student_id = student_id_bytes.decode("utf-8")
    
    user = db.query(User).filter(User.student_id == student_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="找不到此學生")

    today = datetime.now().strftime("%Y-%m-%d")
    reservation = db.query(Reservation).filter(
        Reservation.user_id == user.id,
        Reservation.res_date == today
    ).first()

    if not reservation:
        # 如果今日沒有預約，也先刪除該 Token，防止被重覆利用
        redis_client.delete(redis_key)
        raise HTTPException(
            status_code=404,
            detail=f"{user.name or user.student_id} 今日沒有預約，無法簽到"
        )

    if reservation.attendance_status == "present":
        # 如果已經簽到成功，也把 Redis Key 刪掉
        redis_client.delete(redis_key)
        return {
            "message": f"{user.name or user.student_id} 已簽到過了",
            "student_id": user.student_id,
            "student_name": user.name or "",
            "seat_label": reservation.seat.label if reservation.seat else f"#{reservation.seat_id}",
            "already_checked_in": True,
        }

    reservation.attendance_status = "present"
    reservation.check_in_time = datetime.now(timezone.utc)
    reservation.updated_at = datetime.now(timezone.utc)
    db.commit()

    # 簽到成功後，立刻刪除 Redis Key，確保 QR Code 僅能使用一次
    redis_client.delete(redis_key)

    seat = db.query(Seat).filter(Seat.id == reservation.seat_id).first()
    return {
        "message": f"{user.name or user.student_id} 簽到成功！",
        "student_id": user.student_id,
        "student_name": user.name or "",
        "seat_label": seat.label if seat else f"#{reservation.seat_id}",
        "already_checked_in": False,
    }


# ═══════════════════
#  Announcement Routes
# ═══════════════════

class AnnouncementCreate(BaseModel):
    title: str
    content: str  # Markdown
    is_pinned: bool = False


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    is_pinned: Optional[bool] = None


@app.get("/api/announcements")
def get_announcements(db: Session = Depends(get_db)):
    """公開 API — 任何人（含未登入）都可以讀取公告"""
    announcements = db.query(Announcement).options(
        joinedload(Announcement.author)
    ).order_by(
        Announcement.is_pinned.desc(),
        Announcement.created_at.desc()
    ).all()
    result = []
    for a in announcements:
        author = a.author
        result.append({
            "id": a.id,
            "title": a.title,
            "content": a.content,
            "is_pinned": a.is_pinned,
            "author_name": author.name if author and author.name else "管理員",
            "created_at": _format_datetime(a.created_at),
            "updated_at": _format_datetime(a.updated_at),
        })
    return result


@app.post("/api/admin/announcements")
def admin_create_announcement(req: AnnouncementCreate, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    if not req.title.strip() or not req.content.strip():
        raise HTTPException(status_code=400, detail="標題和內容不能為空")
    ann = Announcement(
        title=req.title.strip(),
        content=req.content.strip(),
        is_pinned=req.is_pinned,
        author_id=admin.id
    )
    db.add(ann)
    db.commit()
    return {"message": "公告已發布", "id": ann.id}


@app.put("/api/admin/announcements/{ann_id}")
def admin_update_announcement(ann_id: int, req: AnnouncementUpdate, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    ann = db.query(Announcement).filter(Announcement.id == ann_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="找不到此公告")
    if req.title is not None:
        ann.title = req.title.strip()
    if req.content is not None:
        ann.content = req.content.strip()
    if req.is_pinned is not None:
        ann.is_pinned = req.is_pinned
    ann.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "公告已更新"}


@app.delete("/api/admin/announcements/{ann_id}")
def admin_delete_announcement(ann_id: int, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    ann = db.query(Announcement).filter(Announcement.id == ann_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="找不到此公告")
    db.delete(ann)
    db.commit()
    return {"message": "公告已刪除"}


# ═══════════════════
#  🏴 彩蛋CTF
# ═══════════════════
import base64
import hashlib
from fastapi.responses import JSONResponse


class EasterEggFlagRequest(BaseModel):
    passphrase: str


@app.get("/api/.easter-egg")
def easter_egg_start():
    """Layer 2:Return the Base64 encoded clue"""
    hint = base64.b64encode(
        "Welcome, curious one. You found the entrance.\n\n"
        "next step: GET /api/.easter-egg/deeper\n"
        "But the answer isn't in the response body...\n"
        "Hint: HTTP response except body, what else?".encode("utf-8")
    ).decode("utf-8")
    return {"message": "Welcome, curious one. You found the entrance.", "data": hint}


@app.get("/api/.easter-egg/deeper")
def easter_egg_deeper():
    """Layer 3:The clue is hidden in the Response Header"""
    clue = base64.b64encode(
        "final stage!！show your technical ability.\n\n"
        "POST /api/.easter-egg/flag\n"
        "Content-Type: application/json\n"
        "Body: {\"passphrase\": \"<'fssh-kbook-2026' MD5 Hash>\"}\n\n"
        "Hint: echo -n 'fssh-kbook-2026' | md5sum".encode("utf-8")
    ).decode("utf-8")
    response = JSONResponse(content={"message": "here nothing"})
    response.headers["X-FSSH-Clue"] = clue
    return response


@app.post("/api/.easter-egg/flag")
def easter_egg_flag(req: EasterEggFlagRequest):
    """Layer 4:Verify the MD5 passphrase and return the final message"""
    expected = hashlib.md5("fssh-kbook-2026".encode()).hexdigest()
    if req.passphrase != expected:
        return JSONResponse(
            status_code=403,
            content={"error": "The passphrase is incorrect, try again!"}
        )
    return {
        "flag": "fsshFLAG{kstudy_system_the_f1na1_stage_cl3ar}",
        "message": (
            "🎉 Congratulation, you completed all the challenges!\n\n"
            "如果你有興趣接手維護「K書中心的預約系統」，\n"
            "請填寫這個表單：[https://forms.gle/3UwBZyx6v3eHzqgT9]\n"
            "這個系統是我受主任之託寫的，\n"
            "期待你成為下一代的維護者！\n"
            "百十五級kohiro留\n"
            "mymail：[kohiro961021@gmail.com]"
        ),
    }
