#!/bin/bash
# ═══════════════════════════════════════════════════════
#  K-Study Center — 一鍵部署腳本
#
#  用法：bash deploy.sh
#
#  此腳本會：
#    1. 檢查前置條件（Docker, .env.prod, 前端 build）
#    2. 自動產生 .env.prod（如果不存在）
#    3. Build 前端（如果沒有 dist/）
#    4. 取得 SSL 憑證（如果還沒有）
#    5. 啟動所有 Docker 容器
#    6. 建立管理員帳號（首次部署）
# ═══════════════════════════════════════════════════════
set -e

# ── 路徑設定 ──
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$SCRIPT_DIR"
DOMAIN="kbook.fssh.khc.edu.tw"

# 顏色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

print_header() {
  echo ""
  echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  🎓 K-Study Center — 部署${NC}"
  echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
  echo ""
}

print_step() {
  echo -e "\n${GREEN}[Step $1]${NC} ${BOLD}$2${NC}"
}

print_ok() {
  echo -e "  ${GREEN}✓${NC} $1"
}

print_warn() {
  echo -e "  ${YELLOW}⚠${NC} $1"
}

print_err() {
  echo -e "  ${RED}✗${NC} $1"
}

# ═══════════════════════════════════════════
print_header

# ── Step 1：前置檢查 ──
print_step "1/6" "前置環境檢查"

# Docker
if ! [ -x "$(command -v docker)" ]; then
  print_err "Docker 未安裝。請先安裝 Docker：https://docs.docker.com/engine/install/"
  exit 1
fi
print_ok "Docker $(docker --version | awk '{print $3}' | tr -d ',')"

# Docker Compose
if ! docker compose version &>/dev/null; then
  print_err "Docker Compose V2 未安裝"
  exit 1
fi
print_ok "Docker Compose $(docker compose version --short)"

# Node.js（build 前端用）
if ! [ -x "$(command -v node)" ]; then
  print_warn "Node.js 未安裝，若 dist/ 不存在將無法自動 build 前端"
else
  print_ok "Node.js $(node --version)"
fi

# 確認在正確目錄
if [ ! -f "$BACKEND_DIR/docker-compose.yml" ]; then
  print_err "找不到 docker-compose.yml，請在 backend/ 目錄下執行"
  exit 1
fi
print_ok "專案目錄正確"

# ── Step 2：設定 .env.prod ──
print_step "2/6" "檢查生產環境設定 (.env.prod)"

cd "$BACKEND_DIR"

if [ -f ".env.prod" ]; then
  print_ok ".env.prod 已存在"

  # 驗證必要欄位
  if ! grep -q "SECRET_KEY=" .env.prod || grep -q "請替換" .env.prod; then
    print_warn ".env.prod 中可能有未填寫的欄位，請確認已填入真實值"
  fi
else
  print_warn ".env.prod 不存在，將自動產生..."

  # 產生強密碼
  SECRET_KEY=$(openssl rand -hex 32)
  DB_PASSWORD=$(openssl rand -hex 16)

  cat > .env.prod <<EOF
# =============================================
# K-Study Center — 生產環境設定（自動產生）
# 產生時間：$(date '+%Y-%m-%d %H:%M:%S')
# =============================================

# JWT 簽名密鑰（已自動產生）
SECRET_KEY=${SECRET_KEY}

# 資料庫連線
DATABASE_URL=postgresql+psycopg://kstudy_user:${DB_PASSWORD}@db:5432/kstudy
REDIS_URL=redis://redis:6379/0

# Google OAuth
GOOGLE_CLIENT_ID=請填入你的_Google_Client_ID

# PostgreSQL 容器設定（密碼必須與 DATABASE_URL 一致）
POSTGRES_USER=kstudy_user
POSTGRES_PASSWORD=${DB_PASSWORD}
POSTGRES_DB=kstudy
EOF

  print_ok ".env.prod 已自動產生（SECRET_KEY 和資料庫密碼已隨機生成）"
  echo ""
  echo -e "  ${YELLOW}⚠ 重要：請編輯 .env.prod 填入 GOOGLE_CLIENT_ID${NC}"
  echo -e "  ${YELLOW}  執行：nano .env.prod${NC}"
  echo ""
  read -p "  已填入 GOOGLE_CLIENT_ID？按 Enter 繼續（或 Ctrl+C 取消）..." _
fi

# ── Step 3：Build 前端 ──
print_step "3/6" "檢查前端 build"

cd "$PROJECT_ROOT"

if [ -d "dist" ] && [ -f "dist/index.html" ]; then
  print_ok "dist/ 目錄已存在（$(ls dist/assets/ 2>/dev/null | wc -l) 個 asset 檔案）"
else
  if [ -x "$(command -v npm)" ]; then
    print_warn "dist/ 不存在，開始 build 前端..."

    # 安裝依賴（如果需要）
    if [ ! -d "node_modules" ]; then
      echo "  安裝 npm 依賴..."
      npm install --silent
    fi

    echo "  執行 npm run build..."
    npm run build

    if [ -f "dist/index.html" ]; then
      print_ok "前端 build 完成"
    else
      print_err "前端 build 失敗，dist/index.html 不存在"
      exit 1
    fi
  else
    print_err "dist/ 不存在且 npm 未安裝，無法 build 前端"
    echo "  請在有 Node.js 的環境下執行 npm run build，然後把 dist/ 複製到伺服器"
    exit 1
  fi
fi

# ── Step 4：SSL 憑證 ──
print_step "4/6" "檢查 SSL 憑證"

cd "$BACKEND_DIR"

CERT_PATH="./certbot/conf/live/$DOMAIN"

if [ -d "$CERT_PATH" ] && [ -f "$CERT_PATH/fullchain.pem" ]; then
  # 檢查是否為自簽憑證
  ISSUER=$(openssl x509 -in "$CERT_PATH/fullchain.pem" -issuer -noout 2>/dev/null || echo "unknown")
  if echo "$ISSUER" | grep -q "Let's Encrypt\|R3\|R4\|R10\|R11\|E5\|E6"; then
    EXPIRY=$(openssl x509 -in "$CERT_PATH/fullchain.pem" -enddate -noout 2>/dev/null | cut -d= -f2)
    print_ok "Let's Encrypt 憑證已存在（到期日：$EXPIRY）"
  else
    print_warn "發現非 Let's Encrypt 的憑證（可能是臨時自簽），將重新申請..."
    bash init-ssl.sh
  fi
else
  print_warn "SSL 憑證不存在，開始申請..."
  bash init-ssl.sh
fi

# ── Step 5：啟動所有服務 ──
print_step "5/6" "啟動 Docker 服務"

cd "$BACKEND_DIR"

echo "  Building and starting containers..."
docker compose up -d --build

# 等待服務啟動
echo "  等待服務啟動..."
sleep 5

# 檢查所有容器是否正常運行
RUNNING=$(docker compose ps --format '{{.Name}} {{.Status}}' 2>/dev/null)
ALL_OK=true

for SERVICE in kstudy_app kstudy_db kstudy_redis kstudy_nginx; do
  if echo "$RUNNING" | grep -q "$SERVICE.*Up"; then
    print_ok "$SERVICE 運行中"
  else
    print_err "$SERVICE 未正常啟動"
    ALL_OK=false
  fi
done

if [ "$ALL_OK" = false ]; then
  echo ""
  print_err "部分服務未正常啟動，請檢查 logs："
  echo "  docker compose logs --tail=20"
  exit 1
fi

# ── Step 6：建立管理員帳號 ──
print_step "6/6" "管理員帳號設定"

# 檢查是否已有管理員
HAS_ADMIN=$(docker exec kstudy_app python -c "
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from models import User
import os
engine = create_engine(os.getenv('DATABASE_URL'))
db = Session(bind=engine)
admin = db.query(User).filter(User.is_admin == True).first()
print('yes' if admin else 'no')
db.close()
" 2>/dev/null || echo "error")

if [ "$HAS_ADMIN" = "yes" ]; then
  print_ok "管理員帳號已存在"
elif [ "$HAS_ADMIN" = "no" ]; then
  print_warn "尚未建立管理員帳號"
  echo ""
  read -p "  請輸入管理員學號（如 fssh_admin）：" ADMIN_ID
  read -sp "  請輸入管理員密碼：" ADMIN_PW
  echo ""

  if [ -n "$ADMIN_ID" ] && [ -n "$ADMIN_PW" ]; then
    docker exec kstudy_app python seed_user.py "$ADMIN_ID" "$ADMIN_PW" true
    print_ok "管理員帳號已建立"
  else
    print_warn "跳過，稍後可用以下指令建立："
    echo "  docker exec -it kstudy_app python seed_user.py <學號> <密碼> true"
  fi
else
  print_warn "無法檢查管理員狀態（可能是首次啟動，資料庫尚在初始化）"
  echo "  稍後可用以下指令建立管理員："
  echo "  docker exec -it kstudy_app python seed_user.py <學號> <密碼> true"
fi

# ═══════════════════════════════════════════
echo ""
echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ 部署完成！${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  🌐 網址：${CYAN}https://$DOMAIN${NC}"
echo ""
echo -e "  ${BOLD}常用指令：${NC}"
echo "  查看 logs     → cd backend && docker compose logs -f"
echo "  重啟服務      → cd backend && docker compose restart"
echo "  停止服務      → cd backend && docker compose down"
echo "  更新部署      → git pull && npm run build && cd backend && docker compose up -d --build"
echo "  手動續簽 SSL  → cd backend && docker compose run --rm certbot renew"
echo ""
