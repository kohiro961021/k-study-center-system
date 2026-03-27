import os
import redis
import smtplib
from email.mime.text import MIMEText
from datetime import datetime, timedelta

class MailService:
    def __init__(self):
        self.redis_client = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"))
        self.smtp_server = "smtp.gmail.com" # Example
        self.smtp_port = 587
        self.sender_email = os.getenv("MAIL_SENDER", "noreply@kstudy.edu.tw")
        self.sender_password = os.getenv("MAIL_PASSWORD", "secret")

    def generate_verification_code(self, student_id: str) -> str:
        import random
        code = f"{random.randint(100000, 999999)}"
        # Store in Redis with 5 minute expiration
        self.redis_client.setex(f"verify:{student_id}", 300, code)
        return code

    def verify_code(self, student_id: str, code: str) -> bool:
        stored_code = self.redis_client.get(f"verify:{student_id}")
        if stored_code and stored_code.decode('utf-8') == code:
            self.redis_client.delete(f"verify:{student_id}")
            return True
        return False

    def send_verification_email(self, student_id: str):
        code = self.generate_verification_code(student_id)
        recipient = f"{student_id}@fssh.khc.edu.tw"
        
        msg = MIMEText(f"Your K-Study Center verification code is: {code}\nValid for 5 minutes.")
        msg['Subject'] = "K-Study Verification Code"
        msg['From'] = self.sender_email
        msg['To'] = recipient

        # In a real app, use async task queue (Celery) for sending
        print(f"[MOCK EMAIL] To: {recipient}, Code: {code}")
        # self._send_smtp(msg) # Commented out for mock

    def send_reminder(self, user_email: str, reservation_details: str):
        msg = MIMEText(f"Reminder: You have a reservation at {reservation_details}. Don't be late!")
        msg['Subject'] = "K-Study Reservation Reminder"
        msg['From'] = self.sender_email
        msg['To'] = user_email
        
        print(f"[MOCK REMINDER] To: {user_email}, Details: {reservation_details}")

    def _send_smtp(self, msg):
        try:
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.sender_email, self.sender_password)
                server.send_message(msg)
        except Exception as e:
            print(f"Failed to send email: {e}")
