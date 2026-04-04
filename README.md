# 🎓 K-Study Center System (K 書中心預約系統)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?style=flat&logo=FastAPI&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%2019-61DAFB.svg?style=flat&logo=React&logoColor=black)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Container-Docker-2496ED.svg?style=flat&logo=Docker&logoColor=white)](https://www.docker.com/)

這是一個為 K 書中心設計的自動化座位預約系統，旨在幫助學生高效管理學習時段，並確保座位的公平分配。

---

## 🌟 核心功能 (Key Features)

### 🎒 學生預約端 (Student Side)
- **多館別選擇**：完整的「新館」與「舊館」座位配置，包含 314 個真實座位。
- **週末規則**：週六日僅開放舊館，新館自動標示為不可預約。
- **直覺式選位**：採用視覺化介面輕鬆點擊預約感興趣的座位。
- **多元登入方式**：支援學號信箱驗證註冊與學校 Google 帳號 (`@fssh.khc.edu.tw`) 一鍵登入。
- **預約管理**：可取消未來的預約；過去日期或當天已點名的預約自動歸入「歷史紀錄」，無法取消。
- **歷史紀錄**：獨立的歷史預約頁面，顯示出席狀態追蹤。

### 🛡️ 管理員後台 (Admin Dashboard)
- **全域管理**：具備代領座位、強制取消預約以及重設學生密碼之權限。
- **出席追蹤系統**：即時標記學生「有到」或「未到」，並統計每日預約人數。
- **座位維修管理**：管理員可直接將座位設為「維修中」並鎖定，自動取消該座位未來所有預約。
- **座位註記維護**：地圖上的座位支援動態註記（如：設備維修、特殊用途）。
- **預約紀錄排序**：支援按學號、座位、日期、建立時間、最後修改時間排序，並記錄每筆預約的修改時間。
- **視覺化監控**：一覽全館 314 個座位的預約分佈，協助中心管理人員調度。

### ⚡ 系統穩定性與安全性 (System Robustness & Security)
- **並發衝突保護**：利用 **Redis 分散式鎖**，確保同一秒內不會有學生搶到同一個位置。
- **防腳本搶位**：Per-User Rate Limiter（每人每分鐘最多 5 次預約嘗試），防止機器人搶座位。
- **日期格式驗證**：嚴格 `YYYY-MM-DD` 格式驗證，防止非標準日期進入資料庫。
- **XSS 防護**：出席名單列印等動態輸出均經過 HTML 轉義處理。
- **身份安全驗證**：Nginx 層級的 `X-KLib-Key` 安全驗證與頻率限制。
- **即時地圖回報**：與資料庫即時連動，準確反映當前空位狀態。

---

## 🚀 技術架構 (Tech Stack)

### 前端 (Frontend)
- **React 19**: 使用最新並發模式開發。
- **Vite**: 提供極速的熱重載與打包速度。
- **Tailwind CSS**: 現代化的實用類導向樣式框架。
- **Framer Motion**: 流暢的頁面切換與組件動畫。
- **Lucide Icons**: 精美的圖標集。

### 後端 (Backend)
- **FastAPI**: 高性能非同步 Python Web 框架。
- **PostgreSQL**: 穩定、可靠的關聯式資料庫。
- **Redis**: 
  - **Distributed Lock**: 使用 Redis Lock 處理預約時的 Race Condition。
  - **Rate Limiting**: 滑動窗口 Per-User 頻率限制，防止自動化腳本。
  - **Caching**: 存儲臨時驗證碼。
- **JWT (HS256)**: 基於 Token 的安全身份驗證。
- **SQLAlchemy (ORM)**: 資料庫模型與查詢管理。

### 基礎設施 (Infrastructure)
- **Nginx**: 作為反向代理與安全過慮層。
- **Docker / Docker Compose**: 提供開發與部署環境的一致性。

---

## 🛠️ 快速開始 (Quick Start)

### 方式一：使用 Docker 部署 (推薦)

1. **複製專案**
   ```bash
   git clone <your-repo-url>
   cd k-study-center-system
   ```

2. **啟動後端** (PostgreSQL + Redis + FastAPI + Nginx)
   ```bash
   cd backend
   docker-compose up --build -d
   ```

3. **啟動前端** (Vite 開發伺服器)
   ```bash
   # 回到專案根目錄
   npm install
   npm run dev
   ```

   系統將自動建立並啟動所有後端服務。
   - 前端訪問：`http://localhost:3000`（開發模式）或 `http://localhost`（Docker Nginx）
   - API 文檔：`http://localhost/docs`（需攜帶正確 Header）

---

## 🔑 Google OAuth 設定指南

本系統支援學校 Google 帳號 (`@fssh.khc.edu.tw`) 直接登入。若要啟用此功能，您需要依照以下步驟在 Google Cloud Console 配置憑證：

### 1. 建立 Google Cloud 專案
1. 前往 [Google Cloud Console](https://console.cloud.google.com/)。
2. 建立一個新專案（例如：`fssh-kstudy-system`）。

### 2. 設定 OAuth 同意畫面 (Consent Screen)
1. 在左側選單選擇 **「API 和服務」** > **「OAuth 同意畫面」**。
2. **User Type**：
   - 建議選擇 **「內部 (Internal)」**：僅限制學校網域內使用者登入。
   - 若選擇「外部」，則需通過 Google 驗證或維持在測試模式。
3. 填寫必要資訊（App Name: `K-Study Center`、Support Email 等）。
4. 在 **「範圍 (Scopes)」** 中，確保已加入 `.../auth/userinfo.email` 與 `.../auth/userinfo.profile`。

### 3. 建立 OAuth 2.0 用戶端 ID
1. 前往 **「憑證」** 頁面，點擊 **「建立憑證」** > **「OAuth 用戶端 ID」**。
2. **應用程式類型**：選擇 **「網頁應用程式 (Web Application)」**。
3. **已授權的 JavaScript 來源**：
   - 本地開發：`http://localhost:3000`
   - 生產環境：`https://www.fssh.khc.edu.tw`
4. **已授權的重新導向 URI**：
   - (Google 一鍵登入通常只需來源網域，但若未來有後端同步需求可保留預設)。
5. 點擊「建立」後，複製產生的 **Client ID**。

### 4. 配置環境變數
將取得的 Client ID 填入專案根目錄的 `.env` 檔案中：
```bash
GOOGLE_CLIENT_ID=你的用戶端ID_在此貼上.apps.googleusercontent.com
```

*完成後重啟 Docker 容器。前端選位頁面會自動顯示「使用 Google 帳號登入」的按鈕。*

---

## ☁️ 雲端部署 (Cloudflare Tunnel)

本系統支援透過 **Cloudflare Tunnel (Cloudflared)** 進行內網穿透，適合於學校內部伺服器或無固定公網 IP 的環境，並支援 `www.fssh.khc.edu.tw` 等自定義域名。

### 1. 取得 Cloudflare Tunnel Token
1. 登入 [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)。
2. 進入 **Networks** -> **Tunnels** -> **Create a Tunnel**。
3. 選擇 **Cloudflared** 類型並為其命名（如 `kstudy-server`）。
4. 在 **Install and run a connector** 頁面選擇 **Docker**，複製指令中的 `TUNNEL_TOKEN` ( `--token` 後的一長串字元)。

### 2. 更新 `docker-compose.yml`
在您的 `docker-compose.yml` 中加入 `cloudflared` 服務，使其與 `nginx` 處於同一網路：

```yaml
services:
  # ... 其他服務
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: kstudy_tunnel
    restart: always
    environment:
      - TUNNEL_TOKEN=貼上您的_TOKEN_字串
    command: tunnel --no-autoupdate run
    depends_on:
      - nginx
```

### 3. 設定 Public Hostname 路由
在 Cloudflare 控制台的 **Public Hostname** 分頁點擊 **Add a public hostname**：
- **Subdomain**: `www`
- **Domain**: `fssh.khc.edu.tw`
- **Service Type**: `HTTP`
- **URL**: `kstudy_nginx:80` (指向 Docker 內網中的 Nginx 服務)

*完成後，流量會經由 Cloudflare 高速網路直接安全地導向您的伺服器，無需開啟 SSH 或路由器 Port Forwarding。*

---

### 💡 測試與開發技巧 (Testing & Development)

#### 1. 測試學生註冊流程 (獲取驗證碼)
由於目前尚未架設真實的 Mail Server，系統會將驗證碼印在 **後端日誌** 中：
1. 在註冊頁面點擊 **「Send Code」**。
2. 查看運行後端的終端機（或執行 `docker logs kstudy_app`）。
3. 尋找如下日誌：`[MOCK EMAIL] To: ..., Code: 123456`。
4. 使用該 6 位數代碼即可完成註冊。

#### 2. 快速建立測試帳號 (跳過驗證)
使用內建腳本直接在資料庫中建立帳號，支援自定義學號、密碼與權限：

**指令格式：**
`python seed_user.py [學號] [密碼] [是否為管理員:true/false]`

**Docker 環境下：**
```bash
# 建立一般學生
docker exec -it kstudy_app python seed_user.py student001 pass123 false

# 建立管理員 (預設)
docker exec -it kstudy_app python seed_user.py admin001 adminpass true
test account(admin): admin001 / adminpass
test account(student): student001 / 123456
test account(student): student002 / pass2
```
[+] Successfully created:
    - Student ID: admin001
    - Password: adminpass
    - Role: Admin
```
**手動開發環境下：**
```bash
cd backend
python seed_user.py test123 password123 true
```
*註：若不帶參數執行，預設建立 `test123` / `password123` 的管理員帳號。*

#### 3. 資料庫遷移（已有舊資料庫時）
若資料庫已有舊版 schema，需手動執行以下 SQL 更新：
```bash
# 新增 updated_at 欄位
docker exec kstudy_db psql -U user -d kstudy -c \
  "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;"

# 更新特殊座位類型（新館 34/35 工讀生、36/44 柱子）
docker exec kstudy_db psql -U user -d kstudy -c \
  "UPDATE seats SET seat_type = 'staff' WHERE seat_number IN (34, 35);
   UPDATE seats SET seat_type = 'pillar' WHERE seat_number IN (36, 44);"
```

---


## 🐛 疑難排解 (Troubleshooting)

### 問題：學生/管理員無法預約座位、無法編輯註記

**症狀**：登入成功，但點擊座位無反應，或預約時出現錯誤。座位地圖顯示全部灰色（空白佔位符）。

**根本原因**：Docker Volume 中的 PostgreSQL 資料庫保留了**舊版 schema**，與目前程式碼不一致。

具體來說：
- 舊版 `seats` 表只有 `id, label, x, y, status`（20 個座位，標籤為 A1~D5）
- 新版 `seats` 表需要 `id, label, seat_number, zone, building, seat_type, note, status`（314 個座位）
- 舊版 `users` 表缺少 `name`, `email`, `google_id` 欄位

SQLAlchemy 的 `create_all()` **不會修改已存在的表格結構**，且 `init_seats()` 檢測到已有座位資料後會跳過初始化。

**診斷步驟**：

```bash
# 1. 確認 Docker 容器正在運行
docker ps

# 2. 檢查 seats 表的欄位結構
docker exec kstudy_db psql -U user -d kstudy -c "\
  SELECT column_name, data_type \
  FROM information_schema.columns \
  WHERE table_name='seats' \
  ORDER BY ordinal_position;"

# 3. 如果缺少 seat_number, zone, building 等欄位，代表是舊 schema
# 檢查座位數量（應為 314）
docker exec kstudy_db psql -U user -d kstudy -c "SELECT count(*) FROM seats;"

# 4. 同步檢查 users 表是否缺少 name, email, google_id 欄位
docker exec kstudy_db psql -U user -d kstudy -c "\
  SELECT column_name FROM information_schema.columns \
  WHERE table_name='users';"
```

**修復步驟**：

```bash
# ⚠️ 以下操作會清除所有座位和預約資料（用戶帳號保留）

# Step 1: 刪除舊的 seats 和 reservations 表
docker exec kstudy_db psql -U user -d kstudy -c \
  "DROP TABLE IF EXISTS reservations CASCADE; DROP TABLE IF EXISTS seats CASCADE;"

# Step 2: 補齊 users 表缺少的欄位
docker exec kstudy_db psql -U user -d kstudy -c \
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR; \
   ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR; \
   ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR UNIQUE;"

# Step 3: 重新 build 並重啟後端容器
docker-compose -f backend/docker-compose.yml up -d --build app

# Step 4: 觸發座位初始化（呼叫 API 讓 init_seats() 執行）
# PowerShell:
Invoke-RestMethod -Uri "http://127.0.0.1/api/seats" -Headers @{"X-KLib-Key"="test"} | Measure-Object
# Linux/Mac:
# curl -H "X-KLib-Key: test" http://127.0.0.1/api/seats | python -m json.tool | head

# Step 5: 驗證結果（應顯示 314）
docker exec kstudy_db psql -U user -d kstudy -c "SELECT count(*) FROM seats;"
```
5. 🪑 新增特殊座位標記（工讀生 / 柱子）
[MODIFY] 
seat_layout.py
將座位 34、35 從 normal 改為 staff（工讀生）
將座位 36、44 從 normal 改為 pillar（柱子）
需注意：這些座位在 新3(311) 區（29~44）中，需要將 _add(range(29, 45), ...) 拆分為帶特殊標記的版本
WARNING

資料庫遷移：如果已有舊資料庫，需要執行 SQL 更新已存在的座位類型：
```
sql
UPDATE seats SET seat_type = 'staff' WHERE seat_number IN (34, 35);
UPDATE seats SET seat_type = 'pillar' WHERE seat_number IN (36, 44);
```

**預防措施**：
- 更新程式碼後，若涉及資料庫 schema 變更，務必同步更新 Docker 中的資料庫。
- 建議未來引入資料庫遷移工具（如 Alembic）來管理表結構變更。

---

### 問題：前端 API 請求返回 HTML 而非 JSON

**症狀**：瀏覽器 Console 出現 `Unexpected token '<'` 錯誤。

**原因**：Vite 開發伺服器的 proxy 設定指向 `http://127.0.0.1`（port 80），需要 Nginx Docker 容器運行。

**確認**：
```bash
# 確認 nginx 容器正在運行並監聽 port 80
docker ps | findstr nginx
```

**修復**：確保 Docker 容器全部啟動：
```bash
docker-compose -f backend/docker-compose.yml up -d
```

---

## 📖 API 接口說明 (API Reference)

本系統採 RESTful API 設計，所有請求皆須在 Header 攜帶 `X-KLib-Key: test`。涉及身份驗證的接口需攜帶 `Authorization: Bearer <JWT_TOKEN>`。

### 🔐 身份驗證 (Authentication)

| 接口 | 方法 | 說明 | 參數範例 |
| :--- | :--- | :--- | :--- |
| `/api/send-code` | `POST` | 發送註冊驗證碼至學號信箱 | `{ "student_id": "112001" }` |
| `/api/register` | `POST` | 學生註冊 | `{ "student_id": "...", "password": "...", "verification_code": "..." }` |
| `/token` | `POST` | 帳號密碼登入 (OAuth2 Flow) | `username=...&password=...` (Form Data) |
| `/api/auth/google`| `POST` | 學校 Google 帳號登入 | `{ "credential": "<GOOGLE_ID_TOKEN>" }` |

### 📅 學生功能 (Student Features)

| 接口 | 方法 | 說明 | 權限要求 |
| :--- | :--- | :--- | :--- |
| `/api/seats` | `GET` | 取得所有座位配置與狀態 | 公開 (需 Header) |
| `/api/availability`| `GET` | 查詢特定日期的可用位置（週末自動包含新館） | 公開 (需 Header) |
| `/api/my-reservations`| `GET` | 查詢可取消的預約（未來日期 + 當天未點名） | 需登入 |
| `/api/my-history`| `GET` | 查詢歷史預約（過去日期 + 當天已點名） | 需登入 |
| `/api/reserve` | `POST` | 進行座位預約 (限每人/分鐘 5 次，週末禁新館) | 需登入 |
| `/api/reservations/{id}`| `DELETE` | 取消預約（過去/已點名的不可取消） | 需登入 |

### 🛠️ 管理員功能 (Admin Features)

所有管理員接口皆需具備 **Admin 權限** 的 JWT Token。

| 接口 | 方法 | 說明 |
| :--- | :--- | :--- |
| `/api/admin/users` | `GET` | 取得所有學生清單 |
| `/api/admin/reset-password`| `PUT` | 強制重設學生密碼 |
| `/api/admin/reservations` | `GET` | 取得系統內所有預約紀錄 (含建立/修改時間) |
| `/api/admin/reserve` | `POST` | 代替學生進行預約 (週末禁新館) |
| `/api/admin/reservations/{id}`| `PUT` | 修改預約資料 (變更日期或座位) |
| `/api/admin/reservations/{id}`| `DELETE` | 強制取消學生預約 |
| `/api/admin/reservations/{id}/attendance`| `PUT` | 更新出席狀態 (`present` / `absent`) |
| `/api/admin/attendance?date=...`| `GET` | 導出特定日期的出席名單 |
| `/api/admin/seats/{id}/note`| `PUT` | 編輯座位註記 |
| `/api/admin/seats/{id}/status`| `PUT` | 設定座位狀態 (`maintenance` / `available`，維修時自動取消未來預約) |
| `/api/admin/notes` | `GET` | 快速檢視所有含有註記的座位 |

---

## 🛡️ 安全說明 (Security)
... (後續內容保持不變)

本專案在 Nginx 層級實施了開發保護盾：
- 必須在請求 Header 中包含 `X-KLib-Key` 才能訪問 API。
- 內建 IP 流量限制 (Rate Limiting)，防止暴力破解與惡意掃描。

---

## 📂 專案結構 (Project Structure)

```text
├── backend/                   # FastAPI 後端代碼
│   ├── app.py                 # API 主要邏輯與路由
│   ├── models.py              # SQLAlchemy 資料庫模型 (User, Seat, Reservation)
│   ├── seat_layout.py         # 座位配置定義 (新館 1-140 + 舊館 141-314)
│   ├── seed_user.py           # 快速建立測試帳號腳本
│   ├── mail_service.py        # 郵件發送與驗證碼邏輯
│   ├── nginx.conf             # Nginx 反向代理配置
│   ├── docker-compose.yml     # 一鍵部署配置
│   ├── Dockerfile             # 後端容器建置檔
│   └── requirements.txt       # Python 依賴套件
├── src/                       # React 前端源代碼
│   ├── App.tsx                # 主要 UI 組件與路徑控管
│   ├── main.tsx               # 前端入口點
│   └── index.css              # 全域樣式
├── vite.config.ts             # Vite 設定（含 API Proxy）
└── package.json               # 前端依賴
```

---

## 📄 許可證 (License)
本專案基於 **MIT License** 開源。
