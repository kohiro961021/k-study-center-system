#!/bin/bash
# 更新部署腳本：git pull → npm build → docker rebuild

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

GREEN='\033[0;32m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

step() { echo -e "\n${GREEN}[${1}]${NC} ${BOLD}${2}${NC}"; }
ok()   { echo -e "  ${GREEN}✓${NC} ${1}"; }
err()  { echo -e "  ${RED}✗${NC} ${1}"; exit 1; }

# ── 1. git pull ──
step "1/3" "拉取最新程式碼"
cd "$PROJECT_ROOT"
git pull || err "git pull 失敗"
ok "程式碼已更新"

# ── 2. npm run build ──
step "2/3" "Build 前端"
npm run build || err "npm run build 失敗"
ok "前端 build 完成"

# ── 3. docker compose up ──
step "3/3" "重新編譯並啟動容器"
cd "$SCRIPT_DIR"
docker compose up -d --build || err "docker compose up 失敗"
ok "容器已重啟"

echo ""
echo -e "${GREEN}✓ 更新完成${NC}"
