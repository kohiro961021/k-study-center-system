# 🎓 K-Study Center System（K 書中心預約系統）

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?style=flat&logo=FastAPI&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%2019-61DAFB.svg?style=flat&logo=React&logoColor=black)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Container-Docker-2496ED.svg?style=flat&logo=Docker&logoColor=white)](https://www.docker.com/)

鳳山高中 K 書中心自動化座位預約系統，提供 314 個真實座位的線上預約、出席追蹤與管理員後台功能。

---

## ✨ 功能總覽

### 🎒 學生端
- Google 學校帳號（`@fssh.khc.edu.tw`）一鍵登入 / 管理員帳號密碼登入
- 新館 / 舊館視覺化座位地圖，依狀態即時上色（空位 / 已預約 / 維修中 / 工讀生）
- 座位預約（每人每天限一座位，限 7 天內）
- 週末自動限制：週六/日僅開放舊館
- 我的預約 / 取消預約（過去日期或已點名的自動歸入歷史，不可取消）
- 歷史預約紀錄（含出席狀態）
- 公告欄（支援 Markdown 格式）

### 🛡️ 管理員後台
- 全部預約紀錄覽表，支援**關鍵字搜尋**（學號/姓名/座位/日期）與多欄排序
- 每日出席點名（有到 / 未到），出席統計與列印功能
- 座位地圖管理：代為預約、編輯座位註記、設定維修中（自動取消未來所有預約）
- 座位註記總覽頁
- 學生帳號管理：重設學生密碼
- **管理員修改自己的密碼**（需驗證舊密碼 + 兩次確認）
- 公告發布 / 編輯 / 刪除（Markdown 支援、可置頂）

### ⚡ 系統安全與穩定性
- **Redis 分散式鎖**：防止同一時間兩人搶到同一座位（Race Condition）
- **Per-User Rate Limiting**：每人每分鐘最多 5 次預約嘗試，防止機器人刷位
- **Nginx IP Rate Limiting**：每 IP 每秒 10 req，burst 20
- **Nginx X-KLib-Key 驗證**：API 不接受一般的 HTTP 請求
- **JWT HS256** 身份驗證，管理員路由以 404 偽裝（非 403）
- **日期格式嚴格驗證**（Regex + strptime 雙重）
- **Markdown XSS 防護**：渲染前先做 HTML 全跳脫
- **列印功能 XSS 防護**：`escapeHtml()` 處理所有動態資料
- **bcrypt** 密碼 Hash
- **SQLAlchemy ORM**（防 SQL Injection）

---

## 🚀 技術架構

| 層 | 技術 |
|---|---|
| 前端 | React 19 + Vite + Tailwind CSS + Lucide Icons |
| 後端 | FastAPI (Python 3.9) + SQLAlchemy |
| 資料庫 | PostgreSQL 15 |
| 快取 / 鎖 | Redis 7 |
| 身份驗證 | JWT (HS256) + bcrypt + Google OAuth 2.0 |
| 基礎設施 | Docker Compose + Nginx |

---

## 🛠️ 快速開始

### 方式一：Docker 部署（推薦）

```bash
# 1. Clone 專案
git clone <your-repo-url>
cd k-study-center-system

# 2. 啟動後端（PostgreSQL + Redis + FastAPI + Nginx）
cd backend
docker compose up -d --build

# 3. 啟動前端（回到根目錄）
cd ..
npm install
npm run dev
```

- 前端開發入口：`http://localhost:3000`
- 正式入口（Nginx）：`http://localhost`
- API 文件：生產環境已關閉

---

### 建立管理員帳號

使用內建腳本建立管理員（學生透過 Google OAuth 自動建立帳號）：

```bash
# 格式：python seed_user.py [學號] [密碼] [是否為管理員: true/false]
docker exec -it kstudy_app python seed_user.py admin001 你的強密碼 true
```

> ⚠️ 請勿在文件或 commit 中記錄管理員密碼

---

## 🔑 Google OAuth 設定

1. 前往 [Google Cloud Console](https://console.cloud.google.com/) 建立專案
2. 啟用 OAuth 同意畫面，User Type 選「內部」（限學校網域）
3. 建立 OAuth 2.0 用戶端 ID（網頁應用程式），設定授權來源：
   - 開發：`http://localhost:3000`
   - 正式：`https://www.fssh.khc.edu.tw`
4. 將 Client ID 填入：
   - 根目錄 `.env`：`VITE_GOOGLE_CLIENT_ID=<your-client-id>`
   - `backend/docker-compose.yml`：`GOOGLE_CLIENT_ID=<your-client-id>`
5. 重新 build：`docker compose up -d --build`

---

## ☁️ Cloudflare Tunnel 部署

適合無固定公網 IP 的學校內部伺服器：

1. 前往 [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) → Networks → Tunnels → Create
2. 選 Cloudflared，複製 `TUNNEL_TOKEN`
3. 在 `backend/docker-compose.yml` 加入服務：

```yaml
cloudflared:
  image: cloudflare/cloudflared:latest
  container_name: kstudy_tunnel
  restart: always
  environment:
    - TUNNEL_TOKEN=<你的 TOKEN>
  command: tunnel --no-autoupdate run
  depends_on:
    - nginx
```

4. Public Hostname 設定：
   - Subdomain: `www`｜Domain: `fssh.khc.edu.tw`
   - Service: `HTTP`｜URL: `kstudy_nginx:80`

---

## 📖 API 說明

所有 API 請求需帶 Header：`X-KLib-Key: <KLIB_KEY>`
需要登入的請求另需帶：`Authorization: Bearer <JWT_TOKEN>`

### 身份驗證

| 方法 | 路徑 | 說明 |
|---|---|---|
| POST | `/token` | 管理員帳號密碼登入 |
| POST | `/api/auth/google` | Google 學校帳號登入 |

### 學生功能（需登入）

| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/api/seats` | 取得所有座位 |
| GET | `/api/availability?res_date=` | 查詢指定日期可用座位 |
| GET | `/api/my-reservations` | 可取消的預約 |
| GET | `/api/my-history` | 歷史預約紀錄 |
| POST | `/api/reserve` | 預約座位 |
| DELETE | `/api/reservations/{id}` | 取消預約 |
| GET | `/api/announcements` | 取得公告（公開） |

### 管理員功能（需 Admin Token）

| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/api/admin/users` | 學生帳號列表 |
| PUT | `/api/admin/reset-password` | 重設學生密碼 |
| PUT | `/api/admin/change-password` | 管理員改自己的密碼 |
| GET | `/api/admin/reservations` | 所有預約紀錄 |
| POST | `/api/admin/reserve` | 代替學生預約 |
| PUT | `/api/admin/reservations/{id}` | 修改預約 |
| DELETE | `/api/admin/reservations/{id}` | 取消預約 |
| PUT | `/api/admin/reservations/{id}/attendance` | 更新出席狀態 |
| GET | `/api/admin/attendance?date=` | 取得當日出席名單 |
| PUT | `/api/admin/seats/{id}/note` | 編輯座位註記 |
| PUT | `/api/admin/seats/{id}/status` | 設定座位狀態（`maintenance` / `available`） |
| GET | `/api/admin/notes` | 取得所有有註記的座位 |
| POST | `/api/admin/announcements` | 發布公告 |
| PUT | `/api/admin/announcements/{id}` | 編輯公告 |
| DELETE | `/api/admin/announcements/{id}` | 刪除公告 |

---

## 📂 專案結構

```
k-study-center-system/
├── backend/
│   ├── app.py              # FastAPI 主程式，所有 API 路由
│   ├── models.py           # SQLAlchemy 資料模型（User, Seat, Reservation, Announcement）
│   ├── seat_layout.py      # 314 個座位的配置定義
│   ├── seed_user.py        # 快速建立管理員帳號腳本
│   ├── nginx.conf          # Nginx 反向代理 + 安全 Headers + 前端靜態檔案
│   ├── docker-compose.yml  # 後端一鍵部署（含 CVE-2026-42945 修補）
│   ├── Dockerfile          # FastAPI 容器定義
│   ├── deploy.sh           # 一鍵部署腳本（含 SSL + 管理員設定）
│   ├── init-ssl.sh         # Let's Encrypt SSL 憑證申請腳本
│   ├── .dockerignore       # 防止 .env 等機密進入 image
│   └── requirements.txt    # Python 依賴
├── src/
│   ├── components/      # UI 元件 (Navbar, SeatMap, BottomNav)
│   ├── constants/       # 全域常數與靜態設定
│   ├── context/         # 全域狀態管理 (Context Providers)
│   ├── hooks/           # React Hooks
│   ├── views/           # 頁面元件
│   │    ├── admin/         # 管理員專屬頁面 (Attendance, SeatView, etc.)
│   │    ├── user/          # 學生專屬頁面 (Dashboard, ReserveView, etc.)
│   │    └── LoginView.tsx
│   ├── type.ts          # TypeScript 型別定義
│   ├── utils.ts         # 通用函式
│   └── App.tsx          # 主程式 (僅負責組合)
├── dist/                   # 前端 build 產物（由 Nginx serve）
├── vite.config.ts          # Vite 設定（含 /api proxy → 開發用）
└── package.json
```

---

## 🐛 疑難排解

### 修改程式碼後沒有生效

Docker 預設會使用舊的 image，修改後端程式碼後需要重新 build：

```bash
cd backend
docker compose up -d --build
```

### 前端 API 請求返回 HTML 而非 JSON

確認 Nginx Docker 容器有在跑：

```bash
docker ps | findstr nginx
docker compose up -d  # 啟動所有容器
```

### 資料庫 schema 不符（從舊版升級）

```bash
# 查看 seats 欄位
docker exec kstudy_db psql -U user -d kstudy -c \
  "SELECT column_name FROM information_schema.columns WHERE table_name='seats';"

# 若缺少 seat_number, zone, building 等欄位，清除舊 schema：
docker exec kstudy_db psql -U user -d kstudy -c \
  "DROP TABLE IF EXISTS reservations CASCADE; DROP TABLE IF EXISTS seats CASCADE;"

# 重新 build 後端讓 SQLAlchemy 重建
docker compose up -d --build
```

---

## 📄 License

MIT License


## 🚀 生產環境部署教程

### 前置條件

| 需求 | 說明 |
|---|---|
| 伺服器 | Ubuntu 22.04+ / Debian 12+（或任何支援 Docker 的 Linux） |
| Docker | Docker Engine 24+ 含 Docker Compose V2 |
| Node.js | 18+（在本地 build 前端用，伺服器可選） |
| 網域 | 已將 `kbook.fssh.khc.edu.tw` DNS A 記錄指向伺服器 IP |
| 防火牆 | 開放 **80**（HTTP）和 **443**（HTTPS） |
| Google OAuth | 已在 Google Cloud Console 建立 OAuth Client ID |

---

### 方式一：一鍵部署（推薦）

```bash
# 1. 將程式碼放到伺服器
git clone <your-repo-url> ~/k-study-center-system
cd ~/k-study-center-system

# 2. 安裝前端依賴 & build
npm install
npm run build

# 3. 執行一鍵部署腳本
cd backend
bash deploy.sh
```

腳本會自動完成：
- ✅ 檢查 Docker / Docker Compose 是否安裝
- ✅ 自動產生 `.env.prod`（含隨機 SECRET_KEY 和資料庫密碼）
- ✅ 檢查 `dist/` 前端 build 是否存在
- ✅ 用 Let's Encrypt 申請 SSL 憑證
- ✅ 啟動所有 Docker 容器
- ✅ 引導建立管理員帳號

---

### 方式二：手動逐步部署

#### 第 1 步：安裝 Docker

```bash
# Ubuntu / Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# 登出重新登入讓 docker group 生效
```

#### 第 2 步：準備程式碼

```bash
git clone <your-repo-url> ~/k-study-center-system
cd ~/k-study-center-system
```

#### 第 3 步：Build 前端

```bash
# 在有 Node.js 的環境（本機或伺服器）
npm install
npm run build
# 確認 dist/index.html 存在
ls dist/index.html
```

> 💡 如果伺服器沒有 Node.js，可以在本地 build 後用 `scp` 傳 `dist/` 到伺服器

#### 第 4 步：建立 `.env.prod`

```bash
cd ~/k-study-center-system/backend

# 產生隨機密鑰
SECRET_KEY=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -hex 16)

# 從範本建立
cp .env.prod.example .env.prod
nano .env.prod
```

填入以下內容：
```env
SECRET_KEY=<上面產生的 SECRET_KEY>
DATABASE_URL=postgresql+psycopg://kstudy_user:<DB_PASSWORD>@db:5432/kstudy
REDIS_URL=redis://redis:6379/0
GOOGLE_CLIENT_ID=<你的 Google OAuth Client ID>
POSTGRES_USER=kstudy_user
POSTGRES_PASSWORD=<和 DATABASE_URL 中的密碼一致>
POSTGRES_DB=kstudy
```

#### 第 5 步：申請 SSL 憑證

```bash
cd ~/k-study-center-system/backend
bash init-ssl.sh
```

此腳本會：
1. 產生臨時自簽憑證讓 Nginx 能先啟動
2. 透過 Nginx 的 `/.well-known/acme-challenge/` 路徑驗證網域
3. 用 Let's Encrypt 簽發正式 SSL 憑證
4. 自動 reload Nginx 套用新憑證

#### 第 6 步：啟動所有服務

```bash
cd ~/k-study-center-system/backend
docker compose up -d --build
```

#### 第 7 步：建立管理員帳號

```bash
docker exec -it kstudy_app python seed_user.py <管理員學號> <強密碼> true
```

#### 第 8 步：驗證部署

```bash
# 檢查所有容器是否正常運行
docker compose ps

# 檢查 Nginx logs
docker compose logs nginx --tail=20

# 測試 HTTPS
curl -I https://kbook.fssh.khc.edu.tw
```

---

### 🔐 SSL 憑證管理

| 操作 | 指令 |
|---|---|
| 首次申請 | `bash init-ssl.sh` |
| 手動續簽 | `docker compose run --rm certbot renew && docker compose exec nginx nginx -s reload` |
| 查看到期日 | `openssl x509 -in ./certbot/conf/live/kbook.fssh.khc.edu.tw/fullchain.pem -enddate -noout` |
| 自動續簽 | certbot 容器每 12 小時自動檢查，無需手動操作 |

---

### 🔄 更新部署

```bash
cd ~/k-study-center-system

# 拉取最新程式碼
git pull

# 重新 build 前端
npm run build

# 重新 build & 啟動後端
cd backend
docker compose up -d --build
```

---

### 🛠️ 維護常用指令

```bash
cd ~/k-study-center-system/backend

# 查看所有容器狀態
docker compose ps

# 即時查看 logs
docker compose logs -f

# 只看某個服務的 logs
docker compose logs -f app
docker compose logs -f nginx

# 重啟所有服務
docker compose restart

# 停止所有服務
docker compose down

# 停止並清除所有資料（⚠️ 會刪除資料庫）
docker compose down -v

# 進入 app 容器的 shell
docker exec -it kstudy_app bash

# 進入資料庫
docker exec -it kstudy_db psql -U kstudy_user -d kstudy

# 備份資料庫
docker exec kstudy_db pg_dump -U kstudy_user kstudy > backup_$(date +%Y%m%d).sql

# 還原資料庫
cat backup.sql | docker exec -i kstudy_db psql -U kstudy_user -d kstudy
```