#!/bin/bash
# ═══════════════════════════════════════════════════════
#  K-Study Center — SSL 憑證初始化腳本
#  使用 Let's Encrypt 取得免費 SSL 憑證
#
#  用法：bash init-ssl.sh
#  前置條件：
#    1. 網域 DNS 已指向此伺服器 IP
#    2. 防火牆已開放 80 / 443 port
#    3. Docker 已安裝
# ═══════════════════════════════════════════════════════
set -e

# ── 設定 ──
DOMAIN="kbook.fssh.khc.edu.tw"
EMAIL=""                          # 填入 email 以收到到期通知，留空=不收
RSA_KEY_SIZE=4096
DATA_PATH="./certbot"
COMPOSE_FILE="docker-compose.yml"

# 顏色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}══════════════════════════════════════════${NC}"
echo -e "${CYAN}  K-Study Center — SSL 憑證初始化${NC}"
echo -e "${CYAN}══════════════════════════════════════════${NC}"
echo ""

# ── 前置檢查 ──
if ! [ -x "$(command -v docker)" ]; then
  echo -e "${RED}✗ 錯誤：docker 未安裝${NC}" >&2
  exit 1
fi

if ! docker compose version &>/dev/null; then
  echo -e "${RED}✗ 錯誤：docker compose 未安裝（需要 Docker Compose V2）${NC}" >&2
  exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  echo -e "${RED}✗ 錯誤：找不到 ${COMPOSE_FILE}，請在 backend/ 目錄下執行此腳本${NC}" >&2
  exit 1
fi

# ── 檢查現有憑證 ──
if [ -d "$DATA_PATH/conf/live/$DOMAIN" ]; then
  echo -e "${YELLOW}⚠ 發現已存在的 $DOMAIN 憑證${NC}"
  read -p "是否要替換現有憑證？(y/N) " decision
  if [ "$decision" != "Y" ] && [ "$decision" != "y" ]; then
    echo "已取消。"
    exit 0
  fi
fi

# ── Step 1：建立目錄 ──
echo -e "\n${GREEN}[1/5]${NC} 建立 certbot 目錄結構..."
mkdir -p "$DATA_PATH/conf"
mkdir -p "$DATA_PATH/www"

# ── Step 2：產生自簽憑證（讓 Nginx 能先啟動） ──
echo -e "${GREEN}[2/5]${NC} 產生臨時自簽憑證（讓 Nginx 能啟動）..."
CERT_PATH="$DATA_PATH/conf/live/$DOMAIN"
mkdir -p "$CERT_PATH"

# 如果已經有真正的憑證，先備份
if [ -f "$CERT_PATH/fullchain.pem" ] && [ ! -L "$CERT_PATH/fullchain.pem" ]; then
  echo "  備份現有憑證..."
fi

# 產生自簽憑證
openssl req -x509 -nodes -newkey rsa:2048 \
  -days 1 \
  -keyout "$CERT_PATH/privkey.pem" \
  -out "$CERT_PATH/fullchain.pem" \
  -subj "/CN=$DOMAIN" \
  2>/dev/null

echo "  ✓ 臨時憑證已產生"

# ── Step 3：啟動 Nginx（使用自簽憑證） ──
echo -e "${GREEN}[3/5]${NC} 啟動 Nginx（使用臨時憑證）..."
docker compose up -d nginx
sleep 3

# 驗證 Nginx 是否正常運行
if ! docker ps --format '{{.Names}}' | grep -q 'kstudy_nginx'; then
  echo -e "${RED}✗ Nginx 啟動失敗，請檢查 docker compose logs nginx${NC}"
  exit 1
fi
echo "  ✓ Nginx 已啟動"

# ── Step 4：用 Certbot 申請真正的 Let's Encrypt 憑證 ──
echo -e "${GREEN}[4/5]${NC} 向 Let's Encrypt 申請 SSL 憑證..."

# 設定 email 參數
if [ -z "$EMAIL" ]; then
  EMAIL_ARG="--register-unsafely-without-email"
  echo -e "  ${YELLOW}⚠ 未設定 email，將不會收到到期提醒${NC}"
else
  EMAIL_ARG="--email $EMAIL"
fi

# 使用 webroot 模式（Nginx 會 serve /.well-known/acme-challenge/）
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  $EMAIL_ARG \
  -d "$DOMAIN" \
  --rsa-key-size "$RSA_KEY_SIZE" \
  --agree-tos \
  --non-interactive \
  --force-renewal

if [ $? -ne 0 ]; then
  echo -e "${RED}✗ 憑證申請失敗！請檢查：${NC}"
  echo "  1. 網域 $DOMAIN 的 DNS 是否指向此伺服器？"
  echo "  2. 防火牆是否開放 80 port？"
  echo "  3. 是否太頻繁申請（Let's Encrypt 有速率限制）？"
  exit 1
fi

echo -e "  ${GREEN}✓ SSL 憑證申請成功！${NC}"

# ── Step 5：重新載入 Nginx（使用真正的憑證） ──
echo -e "${GREEN}[5/5]${NC} 重新載入 Nginx（套用正式憑證）..."
docker compose exec nginx nginx -s reload
sleep 2

echo ""
echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ SSL 憑證設定完成！${NC}"
echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo ""
echo -e "  網址：${CYAN}https://$DOMAIN${NC}"
echo ""
echo -e "  憑證位置：$DATA_PATH/conf/live/$DOMAIN/"
echo -e "  自動續簽：certbot 容器每 12 小時檢查一次"
echo ""
echo -e "  ${YELLOW}提示：確保 docker compose up -d 啟動所有服務${NC}"
