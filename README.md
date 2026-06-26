<p align="center">
  <img src="backend/logo.png" alt="FlClouds Logo" width="150" />
</p>

<h1 align="center">FlClouds</h1>

<p align="center">
  <img src="https://img.shields.io/github/license/hicocos/FlClouds?style=flat-square&color=blue" alt="License" />
  <img src="https://img.shields.io/github/stars/hicocos/FlClouds?style=flat-square&color=gold" alt="Stars" />
  <img src="https://img.shields.io/github/forks/hicocos/FlClouds?style=flat-square&color=lightgrey" alt="Forks" />
  <img src="https://img.shields.io/github/issues/hicocos/FlClouds?style=flat-square&color=red" alt="Issues" />
  <img src="https://img.shields.io/badge/Docker-Compose-blue?style=flat-square" alt="Docker Compose" />
</p>

<p align="center">
  <strong>FlClouds</strong> 是一款面向个人和小团队的私有云存储系统，支持大文件切片上传、图片/视频预览、Web 管理、Telegram Bot 操作、账号级 Telegram 下载。
</p>

---

## 🚀 快速部署 (Docker Compose)

### 1. 克隆仓库

```bash
git clone https://github.com/hicocos/FlClouds.git
cd FlClouds
```

### 2. 配置环境变量

```bash
cp .env.example .env
vi .env
```

至少建议先填写：

- `DB_PASSWORD`
- `VITE_API_URL`
- `CORS_ORIGIN`
- `DOMAIN`
- 如需 Telegram Bot，再填写 `TELEGRAM_BOT_TOKEN`、`TELEGRAM_API_ID`、`TELEGRAM_API_HASH`
- 如需账号级 Telegram 下载器，再填写 `TELEGRAM_USER_API_ID`、`TELEGRAM_USER_API_HASH`

### 3. 构建前端

`VITE_API_URL` 是前端构建时变量。请先在 `.env` 中设置好它，然后用变量传入构建命令：

```bash
set -a
source .env
set +a

docker build \
  --build-arg VITE_API_URL="${VITE_API_URL}" \
  -t foomclous-frontend:latest \
  ./frontend
```

### 4. 构建后端

```bash
docker build -t foomclous-backend:latest ./backend
```

### 5. 生成用户账号 session（可选）

如果你要启用账号级 Telegram 下载器，请在启动服务前生成 session。该命令会使用 `docker-compose.yml` 中的 `/data` 持久化卷，默认写入 `.env` 里的 `TELEGRAM_USER_SESSION_FILE` 路径。

```bash
docker compose run --rm --no-deps backend npm run login:telegram-user
```

按提示登录 Telegram 后，确认 `.env` 中包含：

```env
TELEGRAM_USER_SESSION_FILE=/data/telegram_user_session.txt
```

如果暂时不使用账号级下载器，可以跳过这一步。

### 6. 启动服务

```bash
docker compose up -d
```

> [!IMPORTANT]
> 修改 `VITE_API_URL` 后必须重新构建前端镜像；仅重启容器不会改变已经打包进前端静态文件的 API 地址。

---

## 🛠️ 环境变量配置

| 变量名 | 说明 | 示例 | 获取说明 |
| :--- | :--- | :--- | :--- |
| `VITE_API_URL` | 前端访问后端的地址，必须包含协议 | `https://api.yourdomain.com` | 你的后端反代公网地址，例如 Nginx/Caddy 指向宿主机 `51947` |
| `DB_PASSWORD` | PostgreSQL 数据库密码 | `change_me_to_a_strong_password` | 自行生成强密码，首次部署前写入 `.env` |
| `CORS_ORIGIN` | 允许跨域的前端来源 | `https://cloud.yourdomain.com` | 你的前端网页公网地址，例如 Nginx/Caddy 指向宿主机 `47832` |
| `DOMAIN` | 应用主域名，不带协议 | `cloud.yourdomain.com` | 填前端主域名，用于生成链接和展示 |
| `ACCESS_PASSWORD_HASH` | 可选，网页登录/接口访问密码的 SHA-256 Hash | `sha256_hash_here...` | 见“生成密码哈希”章节；不填则不启用访问密码 |
| `TELEGRAM_BOT_TOKEN` | 可选，Telegram Bot Token | `123456:ABC-DEF...` | 找 [@BotFather](https://t.me/BotFather) 创建机器人后获取 |
| `TELEGRAM_API_ID` | 可选，Telegram API ID | `123456` | 登录 [my.telegram.org](https://my.telegram.org) 创建应用后获取 |
| `TELEGRAM_API_HASH` | 可选，Telegram API Hash | `abcdef123456...` | 与 `TELEGRAM_API_ID` 在同一页面获取 |
| `TELEGRAM_USER_API_ID` | 可选，账号级下载器 API ID | `123456` | 通常可与 `TELEGRAM_API_ID` 相同；用于用户账号 MTProto session |
| `TELEGRAM_USER_API_HASH` | 可选，账号级下载器 API Hash | `abcdef123456...` | 通常可与 `TELEGRAM_API_HASH` 相同；用于用户账号 MTProto session |
| `TELEGRAM_USER_SESSION_FILE` | 可选，用户账号 session 文件路径 | `/data/telegram_user_session.txt` | 运行 `docker compose run --rm --no-deps backend npm run login:telegram-user` 生成 |
| `TELEGRAM_DOWNLOAD_BRIDGE_CHAT_ID` | 可选，桥接群/频道 ID；多人使用时推荐配置 | `-1001234567890` | 把 bot 和用户账号加入同一群/频道后获取聊天 ID |
| `TELEGRAM_DOWNLOAD_WORKERS` | 可选，Telegram 并发下载 worker 数，建议 4-8 | `4` | 自行按线路稳定性调整；也可通过 Bot 的 `/download_workers` 菜单调整 |
| `YTDLP_BIN` | 可选，yt-dlp 可执行文件路径 | `yt-dlp` | 镜像内默认已安装；只有自定义环境找不到命令时才需要改 |
| `YTDLP_WORK_DIR` | 可选，yt-dlp 下载临时目录 | `./data/uploads/ytdlp` | 默认即可；需要独立磁盘目录时再改 |
| `YTDLP_MAX_CONCURRENT` | 可选，yt-dlp 并发任务数 | `1` | 按服务器 CPU、带宽和目标站点限速情况调整 |

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

### 3. 单人/多人使用建议

| 场景 | 推荐配置 | 说明 |
| :--- | :--- | :--- |
| 单人自用 | 不配置桥接聊天 | 生成 session 的用户账号需要能看到 bot 私聊里的媒体消息 |
| 多人使用 | 配置 `TELEGRAM_DOWNLOAD_BRIDGE_CHAT_ID` | bot 会把私聊收到的文件转发到桥接群/频道，用户账号再从桥接聊天下载 |
| 频道桥接 | bot 通常需要管理员/发消息权限 | bot 和用户账号都必须能访问该频道 |

### 4. Telegram 并发下载调参

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

默认从源码本地构建并使用以下镜像 tag：

- `foomclous-frontend:latest`
- `foomclous-backend:latest`
- `postgres:16-alpine`

如果你修改了前端 API 地址或前端源码，请重新执行前端构建步骤。

---

## 🔄 维护与更新

```bash
cd /root/FlClouds

git pull origin main

set -a
source .env
set +a

docker build \
  --build-arg VITE_API_URL="${VITE_API_URL}" \
  -t foomclous-frontend:latest \
  ./frontend

docker build -t foomclous-backend:latest ./backend

docker compose up -d
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
- 🐳 Docker Compose 容器化部署

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
