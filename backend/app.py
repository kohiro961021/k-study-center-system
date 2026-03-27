import os
import bcrypt
from datetime import datetime, timedelta
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
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
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

# --- Middleware / Dependency for Time Check ---
def check_reservation_time(res_date_str: str, timeslot: str):
    now = datetime.now()
    res_date = datetime.strptime(res_date_str, "%Y-%m-%d").date()
    
    if not (now.date() <= res_date <= now.date() + timedelta(days=7)):
        raise HTTPException(status_code=400, detail="Reservations only allowed for the next 7 days")

    is_weekend = res_date.weekday() >= 5 
    
    if is_weekend:
        if timeslot != "09:00-17:00":
             raise HTTPException(status_code=400, detail="Invalid timeslot for weekend. Must be 09:00-17:00")
    else:
        if timeslot != "17:00-21:00":
             raise HTTPException(status_code=400, detail="Invalid timeslot for weekday. Must be 17:00-21:00")

    if res_date == now.date():
        start_hour = int(timeslot.split(":")[0])
        if now.hour >= start_hour:
             raise HTTPException(status_code=400, detail="Cannot book past timeslots")

# --- Routes ---
@app.post("/api/send-code")
def send_code(student_id: str):
    mail_service.send_verification_email(student_id)
    return {"message": "Verification code sent"}

@app.post("/api/register")
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    if not mail_service.verify_code(user_data.student_id, user_data.verification_code):
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")
    
    if db.query(User).filter(User.student_id == user_data.student_id).first():
        raise HTTPException(status_code=400, detail="User already registered")
    
    hashed_pw = get_password_hash(user_data.password)
    new_user = User(student_id=user_data.student_id, password_hash=hashed_pw)
    db.add(new_user)
    db.commit()
    return {"message": "Registration successful"}

@app.post("/token", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.student_id == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    access_token = create_access_token(
        data={"sub": user.student_id, "admin": user.is_admin}
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/seats")
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

@app.get("/api/my-reservations")
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

    acquired = lock.acquire(blocking=True, blocking_timeout_s=2)
    if not acquired:
        raise HTTPException(status_code=409, detail="Seat is currently being booked by someone else")

    try:
        existing = db.query(Reservation).filter(
            Reservation.res_date == req.res_date,
            Reservation.timeslot == req.timeslot,
            Reservation.seat_id == req.seat_id
        ).first()
        
        if existing:
             raise HTTPException(status_code=409, detail="Seat already reserved")

        user_booking = db.query(Reservation).filter(
            Reservation.res_date == req.res_date,
            Reservation.timeslot == req.timeslot,
            Reservation.user_id == current_user.id
        ).first()

        if user_booking:
            raise HTTPException(status_code=400, detail="You already have a booking for this slot")

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
        raise HTTPException(status_code=404, detail="Reservation not found")
    
    if reservation.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only cancel your own reservations")
    
    db.delete(reservation)
    db.commit()
    return {"message": "Reservation cancelled"}
