# 🎓 K-Study Center System (K 書中心預約系統)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?style=flat&logo=FastAPI&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%2019-61DAFB.svg?style=flat&logo=React&logoColor=black)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Container-Docker-2496ED.svg?style=flat&logo=Docker&logoColor=white)](https://www.docker.com/)

這是一個為 K 書中心設計的自動化座位預約系統，旨在幫助學生高效管理學習時段，並確保座位的公平分配。

---

## 🌟 核心功能 (Key Features)

- **學生帳號管理**：支援學號註冊與登入，內建學號信箱驗證功能。
- **動態席位地圖**：提供 5x4 互動式選位地圖，即時顯示空位與已預約狀態。
- **座位預約機制**：
  - **時段管理**：平日 (17:00-21:00) 與 假日 (09:00-17:00) 特定時段預約。
  - **預約視窗**：僅開放未來 7 天內的座位預約。
  - **公平限制**：同一時段每位學生限制預約一個座位。
- **個人儀表板**：一覽所有預約紀錄，並支援一鍵取消。
- **高併發保護**：利用 Redis 分散式鎖，解決多人同時搶位產生的衝突問題。
- **安全性屏蔽**：Nginx 層級的 `X-KLib-Key` 驗證與流量限制。

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

2. **配置環境變數**
   複製 `.env.example` 並重新命名為 `.env`：
   ```bash
   cp .env.example .env
   ```
   *請務必修改 `.env` 中的 `SECRET_KEY` 與資料庫密碼。*

3. **一鍵啟動**
   ```bash
   docker-compose up --build -d
   ```
   系統將自動建立並啟動 PostgreSQL, Redis, FastAPI 與 Nginx。
   - 前端訪問：`http://localhost`
   - API 文檔：`http://localhost/docs` (需攜帶正確 Header)

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
```

**手動開發環境下：**
```bash
cd backend
python seed_user.py test123 password123 true
```
*註：若不帶參數執行，預設建立 `test123` / `password123` 的管理員帳號。*

---

### 方式二：手動開發環境設定

#### 1. 前端 (Frontend) 設定
```bash
# 進入專案根目錄
npm install

# 啟動 Vite 開發伺服器
npm run dev
```
前端預設運行於：`http://localhost:3000`

#### 2. 後端 (Backend) 設定
```bash
cd backend

# 建議建立虛擬環境 (Virtual Environment)
python -m venv venv

# 啟動虛擬環境 (Windows)
.\venv\Scripts\activate
# 啟動虛擬環境 (Mac/Linux)
# source venv/bin/activate

# 安裝連線與運行所需的套件
pip install -r requirements.txt

# 啟動 FastAPI (使用 Uvicorn)
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```
後端預設運行於：`http://localhost:8000`

---

## 🛡️ 安全說明 (Security)

本專案在 Nginx 層級實施了開發保護盾：
- 必須在請求 Header 中包含 `X-KLib-Key` 才能訪問 API。
- 內建 IP 流量限制 (Rate Limiting)，防止暴力破解與惡意掃描。

---

## 📂 專案結構 (Project Structure)

```text
├── backend/               # FastAPI 後端代碼
│   ├── app.py             # API 主要邏輯與路由
│   ├── models.py          # SQLAlchemy 資料庫模型
│   ├── mail_service.py    # 郵件發送與驗證碼邏輯
│   └── nginx.conf         # Nginx 配置
├── src/                   # React 前端源代碼
│   ├── App.tsx            # 主要 UI 組件與路徑控管
│   └── main.tsx           # 前端入口點
├── docker-compose.yml     # 一鍵部署配置
└── package.json           # 前端依賴
```

---

## 📄 許可證 (License)
本專案基於 **MIT License** 開源。
