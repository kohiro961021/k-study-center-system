import os
import smtplib
from email.mime.text import MIMEText
from email.header import Header

def send_email_sync(subject: str, recipient: str, html_body: str):
    """
    使用 Python 內建的 smtplib 與 email 模組同步發送 HTML 郵件。
    因為是同步發送，可以完美相容於背景排程任務中的多執行緒環境。
    """
    smtp_host = os.getenv("SMTP_HOST", "localhost")
    smtp_port = int(os.getenv("SMTP_PORT", "1025"))
    smtp_username = os.getenv("SMTP_USERNAME", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    smtp_use_tls = os.getenv("SMTP_USE_TLS", "false").lower() == "true"
    smtp_from_email = os.getenv("SMTP_FROM_EMAIL", "noreply@kstudy.local")
    smtp_from_name = os.getenv("SMTP_FROM_NAME", "K-Study K書中心")

    # 建立信件內容
    msg = MIMEText(html_body, 'html', 'utf-8')
    msg['Subject'] = Header(subject, 'utf-8')
    msg['From'] = f"{Header(smtp_from_name, 'utf-8')} <{smtp_from_email}>"
    msg['To'] = recipient

    try:
        if smtp_use_tls:
            server = smtplib.SMTP(smtp_host, smtp_port)
            server.starttls()
        else:
            server = smtplib.SMTP(smtp_host, smtp_port)

        if smtp_username and smtp_password:
            server.login(smtp_username, smtp_password)

        server.sendmail(smtp_from_email, [recipient], msg.as_string())
        server.quit()
        print(f"[Mail] Email successfully sent to {recipient}")
        return True
    except Exception as e:
        print(f"[Mail] Failed to send email to {recipient}: {e}")
        return False
