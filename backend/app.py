import os
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, status, Request, Header
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from jose import JWTError, jwt
from pydantic import BaseModel
import redis

from models import Base, User, Seat, Reservation
from mail_service import MailService

# --- Configuration ---
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg://user:password@localhost/kstudy")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
SECRET_KEY = os.getenv("SECRET_KEY", "super_secret_key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

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
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

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

# Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

mail_service = MailService()

# --- Pydantic Models ---
class UserRegister(BaseModel):
    student_id: str
    password: str
    verification_code: str

class Token(BaseModel):
    access_token: str
    token_type: str

class ReservationRequest(BaseModel):
    seat_id: int
    res_date: str # YYYY-MM-DD
    timeslot: str # "17:00-21:00" or "09:00-17:00"

class SendCodeRequest(BaseModel):
    student_id: str

class SeatOut(BaseModel):
    id: int
    label: str
    x: int
    y: int
    status: str
    model_config = {"from_attributes": True}

class ReservationOut(BaseModel):
    id: int
    user_id: int
    seat_id: int
    res_date: str
    timeslot: str
    model_config = {"from_attributes": True}

class AdminReservationOut(BaseModel):
    id: int
    user_id: int
    seat_id: int
    res_date: str
    timeslot: str
    student_id: str  # 加上學號方便管理員辨識
    seat_label: str  # 加上座位標籤
    model_config = {"from_attributes": True}

class ResetPasswordRequest(BaseModel):
    student_id: str
    new_password: str

class UserOut(BaseModel):
    id: int
    student_id: str
    is_admin: bool
    model_config = {"from_attributes": True}

# --- Middleware / Dependency for Time Check ---
def check_reservation_time(res_date_str: str, timeslot: str):
    now = datetime.now()
    res_date = datetime.strptime(res_date_str, "%Y-%m-%d").date()
    
    if not (now.date() <= res_date <= now.date() + timedelta(days=7)):
        raise HTTPException(status_code=400, detail="只能預約未來 7 天內的座位")

    is_weekend = res_date.weekday() >= 5 
    
    if is_weekend:
        if timeslot not in ("09:00-12:00", "13:00-17:00"):
             raise HTTPException(status_code=400, detail="假日時段僅限 09:00-12:00（上午）或 13:00-17:00（下午）")
    else:
        if timeslot != "17:00-21:00":
             raise HTTPException(status_code=400, detail="平日時段僅限 17:00-21:00")

    if res_date == now.date():
        start_hour = int(timeslot.split(":")[0])
        if now.hour >= start_hour:
             raise HTTPException(status_code=400, detail="該時段已過，無法預約")

# --- Routes ---
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
    new_user = User(student_id=user_data.student_id, password_hash=hashed_pw)
    db.add(new_user)
    db.commit()
    return {"message": "Registration successful"}

@app.post("/token", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.student_id == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="帳號或密碼錯誤")
    
    access_token = create_access_token(
        data={"sub": user.student_id, "admin": user.is_admin}
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/seats", response_model=List[SeatOut])
def get_seats(db: Session = Depends(get_db)):
    seats = db.query(Seat).all()
    if not seats:
        new_seats = []
        for row in range(4):
            for col in range(5):
                label = f"{chr(65+row)}{col+1}"
                new_seats.append(Seat(label=label, x=col, y=row))
        db.add_all(new_seats)
        db.commit()
        seats = db.query(Seat).all()
    return seats

@app.get("/api/availability")
def get_availability(res_date: str, timeslot: str, db: Session = Depends(get_db)):
    reservations = db.query(Reservation).filter(
        Reservation.res_date == res_date,
        Reservation.timeslot == timeslot
    ).all()
    return [r.seat_id for r in reservations]

@app.get("/api/my-reservations", response_model=List[ReservationOut])
def get_my_reservations(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Reservation).filter(Reservation.user_id == current_user.id).all()

@app.post("/api/reserve")
def create_reservation(
    req: ReservationRequest, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    check_reservation_time(req.res_date, req.timeslot)

    lock_key = f"lock:{req.res_date}:{req.timeslot}:{req.seat_id}"
    lock = redis_client.lock(lock_key, timeout=5)

    acquired = lock.acquire(blocking=True, blocking_timeout=2)
    if not acquired:
        raise HTTPException(status_code=409, detail="此座位正在被其他人預約中，請稍後再試")

    try:
        existing = db.query(Reservation).filter(
            Reservation.res_date == req.res_date,
            Reservation.timeslot == req.timeslot,
            Reservation.seat_id == req.seat_id
        ).first()
        
        if existing:
             raise HTTPException(status_code=409, detail="此座位已被預約")

        user_booking = db.query(Reservation).filter(
            Reservation.res_date == req.res_date,
            Reservation.timeslot == req.timeslot,
            Reservation.user_id == current_user.id
        ).first()

        if user_booking:
            raise HTTPException(status_code=400, detail="你在此時段已經有預約了")

        new_res = Reservation(
            user_id=current_user.id,
            seat_id=req.seat_id,
            res_date=req.res_date,
            timeslot=req.timeslot
        )
        db.add(new_res)
        db.commit()
        
        return {"message": "Reservation successful", "id": new_res.id}

    finally:
        lock.release()

@app.delete("/api/reservations/{reservation_id}")
def cancel_reservation(
    reservation_id: int, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="找不到此預約")
    
    # 管理員可以取消任何人的預約
    if reservation.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="只能取消自己的預約")
    
    db.delete(reservation)
    db.commit()
    return {"message": "預約已取消"}

# --- Admin Routes ---
@app.get("/api/admin/users", response_model=List[UserOut])
def admin_list_users(
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    return db.query(User).filter(User.is_admin == False).all()

@app.put("/api/admin/reset-password")
def admin_reset_password(
    req: ResetPasswordRequest,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.student_id == req.student_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="找不到此學號")
    if user.is_admin:
        raise HTTPException(status_code=400, detail="無法重設管理員密碼")
    
    user.password_hash = get_password_hash(req.new_password)
    db.commit()
    return {"message": f"已成功重設 {req.student_id} 的密碼"}

@app.get("/api/admin/reservations")
def admin_list_reservations(
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    reservations = db.query(Reservation).all()
    result = []
    for r in reservations:
        user = db.query(User).filter(User.id == r.user_id).first()
        seat = db.query(Seat).filter(Seat.id == r.seat_id).first()
        result.append({
            "id": r.id,
            "user_id": r.user_id,
            "seat_id": r.seat_id,
            "res_date": r.res_date,
            "timeslot": r.timeslot,
            "student_id": user.student_id if user else "未知",
            "seat_label": seat.label if seat else f"#{r.seat_id}",
        })
    return result

@app.delete("/api/admin/reservations/{reservation_id}")
def admin_cancel_reservation(
    reservation_id: int,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="找不到此預約")
    
    db.delete(reservation)
    db.commit()
    return {"message": "已取消該學生的預約"}
