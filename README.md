# 🎓 K-Study Center System（K 書中心預約系統）

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?style=flat&logo=FastAPI&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%2019-61DAFB.svg?style=flat&logo=React&logoColor=black)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Container-Docker-2496ED.svg?style=flat&logo=Docker&logoColor=white)](https://www.docker.com/)

鳳山高中 K 書中心自動化座位預約系統，提供 314 個真實座位的線上預約、出席追蹤與管理員後台功能。

---

## ✨ 功能總覽

### 🎒 學生端
- 帳號密碼登入 + 驗證碼註冊 / Google 學校帳號（`@fssh.khc.edu.tw`）一鍵登入
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
- API 文件：`http://localhost/docs`（需帶 `X-KLib-Key: test` Header）

---

### 建立測試帳號

使用內建腳本直接建立帳號，不需要走驗證碼流程：

```bash
# 格式：python seed_user.py [學號] [密碼] [是否為管理員: true/false]

# 建立管理員
docker exec -it kstudy_app python seed_user.py admin001 adminpass true

# 建立學生
docker exec -it kstudy_app python seed_user.py student001 pass123 false
```
```Student ID: fssh_admin
    - Password: Fssho77463i50
    - Role: Admin
```

---

### 測試學生註冊（驗證碼）

系統目前為 Mock 模式，驗證碼會印在後端 log：

```bash
docker logs kstudy_app | grep "MOCK EMAIL"
# [MOCK EMAIL] To: student001@fssh.khc.edu.tw, Code: 123456
```

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

所有請求需帶 Header：`X-KLib-Key: test`
需要登入的請求另需帶：`Authorization: Bearer <JWT_TOKEN>`

### 身份驗證

| 方法 | 路徑 | 說明 |
|---|---|---|
| POST | `/api/send-code` | 發送驗證碼至學號信箱 |
| POST | `/api/register` | 學生註冊 |
| POST | `/token` | 帳號密碼登入 |
| POST | `/api/auth/google` | Google 帳號登入 |

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
│   ├── mail_service.py     # 驗證碼（目前為 Mock，印在 log）
│   ├── seed_user.py        # 快速建立測試帳號腳本
│   ├── nginx.conf          # Nginx 反向代理 + 安全設定
│   ├── docker-compose.yml  # 後端一鍵部署
│   ├── Dockerfile          # FastAPI 容器定義
│   └── requirements.txt    # Python 依賴
├── src/
│   ├── App.tsx             # 所有頁面 UI 與邏輯
│   ├── main.tsx            # 前端入口
│   └── index.css           # 全域樣式
├── vite.config.ts          # Vite 設定（含 /api proxy → Nginx）
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


## 🚀 上線前你還需要在伺服器上做（3 步）

### 第 1 步：在伺服器上建立 `.env.prod`
```bash
cd ~/你的專案/backend

# 產生強密碼
openssl rand -hex 32  # 複製輸出作為 SECRET_KEY

cp .env.prod.example .env.prod
nano .env.prod   # 填入 SECRET_KEY 和強密碼
```

### 第 2 步：重新 build 前端（因為 KLIB_KEY 改了）
```bash
cd ~/你的專案
npm run build
```

### 第 3 步：重啟 Docker
```bash
cd ~/你的專案/backend
docker compose down && docker compose up -d --build
```