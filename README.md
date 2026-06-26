<p align="center">
  <img src="backend/logo.png" alt="FlClouds Logo" width="150" />
</p>

<h1 align="center">FlClouds</h1>

<p align="center">
  <img src="https://img.shields.io/github/license/hicocos/FlClouds?style=flat-square&color=blue" alt="License" />
  <img src="https://img.shields.io/github/stars/hicocos/FlClouds?style=flat-square&color=gold" alt="Stars" />
  <img src="https://img.shields.io/github/forks/hicocos/FlClouds?style=flat-square&color=lightgrey" alt="Forks" />
  <img src="https://img.shields.io/github/issues/hicocos/FlClouds?style=flat-square&color=red" alt="Issues" />
  <img src="https://img.shields.io/badge/Fork-FlClouds-purple?style=flat-square" alt="Fork" />
</p>

<p align="center">
  <strong>FlClouds</strong> 是基于 FoomClous 魔改的个人私有云存储方案。它保留大文件切片上传、图片/视频预览、Web 管理与 Telegram Bot 集成，并强化了 Telegram 账号级下载、桥接群/频道转发、并发下载调参、任务停止和 Google Drive 授权刷新等自用部署体验。
</p>

> [!NOTE]
> 本仓库是 `hicocos/FlClouds` fork 版本，部署和镜像默认以本仓库源码自行构建为准；不要再使用原项目的旧多 Compose 部署说明或旧 Docker Hub 镜像说明。

---

## 🚀 快速部署 (Docker Compose)

这是最简单、最推荐的方式。当前版本只保留一个 `docker-compose.yml`。

### 1. 克隆仓库
```bash
git clone https://github.com/hicocos/FlClouds.git
cd FlClouds
```

### 2. 配置环境变量
```bash
cp .env.example .env
vi .env  # 修改 DB_PASSWORD、VITE_API_URL、CORS_ORIGIN、DOMAIN 等
```

### 3. 构建并启动

由于 `VITE_API_URL` 是**前端构建时变量**，生产部署前请先确认 `.env` 中的 `VITE_API_URL` 已经是你的真实 API 地址。

```bash
# 构建并启动所有服务
docker compose up -d --build
```

如果你需要手动分步构建，也可以：

```bash
# 构建前端（将地址替换为你的真实 API 地址）
docker build --build-arg VITE_API_URL=https://your-api.example.com -t foomclous-frontend ./frontend

# 构建后端
docker build -t foomclous-backend ./backend

# 启动服务
docker compose up -d
```

> [!IMPORTANT]
> 修改 `VITE_API_URL` 后必须重新构建前端镜像；仅重启容器不会改变已经打包进前端静态文件的 API 地址。

---

## 🛠️ 环境变量配置

在启动前，请确保设置好以下核心变量（建议放入 `.env` 文件）：

| 变量名 | 说明 | 示例 |
| :--- | :--- | :--- |
| `VITE_API_URL` | 前端访问后端的地址，必须包含协议 | `https://api.yourdomain.com` |
| `DB_PASSWORD` | PostgreSQL 数据库密码 | `change_me_to_a_strong_password` |
| `CORS_ORIGIN` | 允许跨域的前端来源 | `https://cloud.yourdomain.com` |
| `DOMAIN` | 应用主域名，不带协议 | `cloud.yourdomain.com` |
| `ACCESS_PASSWORD_HASH` | 可选，网页登录/接口访问密码的 SHA-256 Hash | `sha256_hash_here...` |
| `TELEGRAM_BOT_TOKEN` | 可选，Telegram Bot Token | `123456:ABC-DEF...` |
| `TELEGRAM_API_ID` | 可选，Telegram API ID | `123456` |
| `TELEGRAM_API_HASH` | 可选，Telegram API Hash | `abcdef123456...` |
| `TELEGRAM_USER_API_ID` | 可选，账号级下载器 API ID | `123456` |
| `TELEGRAM_USER_API_HASH` | 可选，账号级下载器 API Hash | `abcdef123456...` |
| `TELEGRAM_USER_SESSION_FILE` | 可选，用户账号 session 文件路径 | `/data/telegram_user_session.txt` |
| `TELEGRAM_DOWNLOAD_BRIDGE_CHAT_ID` | 可选，桥接群/频道 ID；多人使用时推荐配置 | `-1001234567890` |
| `TELEGRAM_DOWNLOAD_WORKERS` | 可选，Telegram 并发下载 worker 数，建议 4-8 | `4` |
| `YTDLP_BIN` | 可选，yt-dlp 可执行文件路径 | `yt-dlp` |
| `YTDLP_WORK_DIR` | 可选，yt-dlp 下载临时目录 | `./data/uploads/ytdlp` |
| `YTDLP_MAX_CONCURRENT` | 可选，yt-dlp 并发任务数 | `1` |

---

## 🤖 Telegram Bot 配置指南

集成 Telegram Bot 后，你可以通过聊天窗口上传文件、查看任务、删除文件、查看存储统计，并调用 yt-dlp 下载视频链接。

### 1. 获取 Bot Token
1. 在 Telegram 中搜索 [@BotFather](https://t.me/BotFather) 并开始对话。
2. 发送 `/newbot`，按提示创建机器人。
3. 复制 BotFather 返回的 `HTTP API TOKEN`。
4. 写入 `.env` 的 `TELEGRAM_BOT_TOKEN`。

### 2. 获取 API ID 和 API Hash
1. 访问 [my.telegram.org](https://my.telegram.org) 并登录 Telegram 账号。
2. 进入 `API development tools`。
3. 创建应用后复制 `api_id` 和 `api_hash`。
4. 如果只用 bot 基础能力，写入 `TELEGRAM_API_ID` / `TELEGRAM_API_HASH`。
5. 如果启用账号级下载器，同时写入 `TELEGRAM_USER_API_ID` / `TELEGRAM_USER_API_HASH`。

### 3. 生成用户账号 session（可选）

账号级下载器让 Telegram 文件下载由用户账号执行，而不是由 bot 账号执行。它适合大文件下载、私有媒体引用刷新和多人桥接场景。

```bash
# 首次构建后执行
cd backend
npm run build
npm run login:telegram-user
```

按提示登录 Telegram 后，把生成的 session 文件路径配置到：

```env
TELEGRAM_USER_SESSION_FILE=/data/telegram_user_session.txt
```

启动后端后，在网页设置中开启“账号级下载器”。开启时会检查 session 是否就绪；如果 session 未准备好会拒绝开启，避免静默回退。

### 4. 单人/多人使用建议

| 场景 | 推荐配置 | 说明 |
| :--- | :--- | :--- |
| 单人自用 | 不配置桥接聊天 | 生成 session 的用户账号需要能看到 bot 私聊里的媒体消息 |
| 多人使用 | 配置 `TELEGRAM_DOWNLOAD_BRIDGE_CHAT_ID` | bot 会把私聊收到的文件转发到桥接群/频道，用户账号再从桥接聊天下载 |
| 频道桥接 | bot 通常需要管理员/发消息权限 | bot 和用户账号都必须能访问该频道 |

### 5. Telegram 并发下载调参

`TELEGRAM_DOWNLOAD_WORKERS` 控制并发分片请求数，默认 `4`。

- `4`：默认推荐，稳定优先
- `8`：更均衡，适合日常大文件
- `12` / `16`：激进模式，需要二次确认，可能更容易遇到 Telegram 限流、断流或账号风险

> Telegram 单次 `upload.getFile` 请求最大约 512KB。这里调的是并发分片数，不是单请求大小。

---

## 🤖 Telegram Bot 可用命令

| 命令 | 描述 |
| :--- | :--- |
| `/start` | 验证身份并开始使用 Bot |
| `/help` | 获取详细帮助信息与使用说明 |
| `/setup_2fa` | 配置或准备双重验证 (TOTP) |
| `/storage` | 查看当前服务器磁盘与存储统计 |
| `/list` | 查看最近上传的文件列表 |
| `/tasks` | 查看当前传输任务队列和下载进度 |
| `/stop_tasks` | 强制停止所有下载任务 |
| `/download_workers` | 打开并发下载调参面板 (4 / 8 / 12 / 16) |
| `/delete <ID>` | 删除指定文件，支持 ID 前缀 |
| `/ytdlp <url>` | 解析视频链接并下载到当前存储源 |

> [!TIP]
> 多文件上传数量达到 9 个及以上时，Bot 会自动进入静默排队模式，避免刷屏；可随时用 `/tasks` 查看进度。

---

## 📥 yt-dlp 视频下载

通过集成 [yt-dlp](https://github.com/yt-dlp/yt-dlp)，你可以直接在 Telegram Bot 中发送视频链接，让服务器解析并下载到当前存储源。

**环境变量**：

| 变量名 | 说明 | 默认值 |
| :--- | :--- | :--- |
| `YTDLP_BIN` | yt-dlp 可执行文件路径 | `yt-dlp` |
| `YTDLP_WORK_DIR` | 下载临时目录 | `./data/uploads/ytdlp` |
| `YTDLP_MAX_CONCURRENT` | 并发下载任务数 | `1` |

**使用方法**：

```text
/ytdlp https://example.com/video
```

限制：仅支持单个链接；需要先通过 `/start` 验证身份；链接必须以 `http://` 或 `https://` 开头。

---

## 🔐 安全与访问控制

如果设置了 `ACCESS_PASSWORD_HASH`，访问网页和 API 将需要输入密码。本应用目前使用 SHA-256 算法进行哈希。

> [!CAUTION]
> Telegram Bot 键盘只适合四位数字密码输入场景；如果你通过 Bot 使用密码登录，请设置四位数字并生成对应 SHA-256 Hash。

### 生成密码哈希

```bash
node -e "console.log(require('crypto').createHash('sha256').update('your_password').digest('hex'))"
```

Linux/macOS 也可以：

```bash
echo -n "your_password" | sha256sum | awk '{print $1}'
```

将生成的 64 位字符串填入 `.env` 的 `ACCESS_PASSWORD_HASH`。

### 双重验证 (TOTP)

FlClouds 内置支持 TOTP 双重验证（如 Google Authenticator）：

- Web 端：在个人设置中扫码激活
- Telegram Bot：发送 `/setup_2fa` 获取设置二维码，并在对话框输入验证码激活
- 启用后，网页登录和使用 Bot 均需二次验证

---

## 🌐 反向代理建议

如果你使用 Nginx、Nginx Proxy Manager 或 Caddy 部署，请参考以下映射：

| 访问域名 | 协议 | 转发至宿主机 IP:端口 | 说明 |
| :--- | :--- | :--- | :--- |
| `cloud.example.com` | HTTPS | `127.0.0.1:47832` | 前端/网页入口 |
| `api.example.com` | HTTPS | `127.0.0.1:51947` | 后端/API 接口 |

> [!CAUTION]
> 开启 HTTPS 后，`.env` 中的 `VITE_API_URL` 和 `CORS_ORIGIN` 都应使用 `https://`，否则浏览器可能拦截请求。

---

## 📦 Docker 镜像说明

当前 fork 推荐**从源码本地构建镜像**：

```bash
docker compose up -d --build
```

`docker-compose.yml` 会构建并使用以下本地镜像 tag：

- `foomclous-frontend:latest`
- `foomclous-backend:latest`
- `postgres:16-alpine`

暂不建议直接使用原项目旧 Docker Hub 镜像，因为它们不包含本 fork 的账号级 Telegram 下载器、桥接转发、并发下载调参和授权刷新改动。

---

## 🔄 维护与更新

```bash
cd /root/FlClouds

git pull origin main

docker compose up -d --build
```

清理无用 Docker 资源：

```bash
docker system prune -f
```

---

## ✨ 功能特性

- 📦 大文件切片上传与断点续传
- 🖼️ 图片缩略图、视频预览与流式播放
- 🤖 Telegram Bot 上传、下载、删除、任务队列与存储统计
- 👤 Telegram 用户账号级 MTProto 下载器
- 🔁 桥接群/频道转发，改善多人私聊媒体不可见问题
- ⚙️ Telegram 并发下载 worker 调参
- 📥 yt-dlp 视频链接下载到当前存储源
- 🔐 Web / Bot 双重验证与访问密码保护
- 🧩 Google Drive 等存储源配置与授权刷新
- 🐳 单一 `docker-compose.yml` 容器化部署

---

## 📂 项目结构

```text
FlClouds/
├── frontend/           # React 网页前端
├── backend/            # Node.js API 与 Telegram 服务
├── init.sql            # 数据库初始化脚本
├── docker-compose.yml  # Docker Compose 部署配置
├── .env.example        # 环境变量模板
└── LICENSE             # MIT License
```

---

## 📄 开源协议

基于 [MIT License](LICENSE) 开源。

---

[![Star History Chart](https://api.star-history.com/svg?repos=hicocos/FlClouds&type=date&legend=top-left)](https://www.star-history.com/#hicocos/FlClouds&type=date&legend=top-left)
