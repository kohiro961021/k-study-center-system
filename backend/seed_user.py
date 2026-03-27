import os
import sys
import argparse
import bcrypt

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

# Import models
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from models import User

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg://user:password@localhost/kstudy")
engine = create_engine(DATABASE_URL)

# 💡 移除 passlib，改用與 app.py 完全相同的純 bcrypt 寫法
def get_password_hash(password):
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def create_user(student_id, password, is_admin=False):
    db = Session(bind=engine)
    try:
        # Check if user already exists
        existing = db.query(User).filter(User.student_id == student_id).first()
        if existing:
            print(f"[-] User {student_id} already exists.")
            return

        hashed_pw = get_password_hash(password)
        new_user = User(student_id=student_id, password_hash=hashed_pw, is_admin=is_admin)
        db.add(new_user)
        db.commit()
        print(f"[+] Successfully created:")
        print(f"    - Student ID: {student_id}")
        print(f"    - Password: {password}")
        print(f"    - Role: {'Admin' if is_admin else 'Student'}")
    except Exception as e:
        print(f"[!] Failed to create user: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Seed a user into K-Study database.')
    parser.add_argument('id', nargs='?', default='test123', help='Student ID')
    parser.add_argument('pw', nargs='?', default='password123', help='Password')
    parser.add_argument('admin', nargs='?', default='true', help='is_admin (true/false)')

    args = parser.parse_args()
    
    # Simple boolean conversion
    is_admin = str(args.admin).lower() == 'true'
    
    create_user(args.id, args.pw, is_admin)