---
name: "admin-auth-system"
version: "1.0.0"
description: "Express.js backend authentication system with JWT, RBAC role-based access control, rate limiting, security headers, and audit logging. Invoke when user needs login, authentication, role permissions, or audit trail for any admin panel."
---

# admin-auth-system — 后台认证与权限管理系统

> **执行前必做：** 生成认证代码前，必须先阅读 [`references/jwt-auth.md`](references/jwt-auth.md) 理解 JWT 认证流程。
> **核心原则：** 密码必须 bcrypt 哈希存储，JWT Secret 至少 32 字符，所有写操作必须记录日志。

## 0. 流水线位置

```
[独立模块] admin-auth-system → 为其他后端服务提供认证能力
```

- **上游依赖**：无（独立模块）
- **下游 Skill**：无（为其他服务提供认证中间件）
- **产出物**：JWT Token + 操作日志
- **总索引**：[SKILLS-INDEX.md](../SKILLS-INDEX.md)

| 验证指标 | 数据 |
|----------|------|
| 核心模块数 | 5 大模块（JWT / RBAC / 安全 / 日志 / 账户） |
| 可运行代码文件 | 7 个 .js 模块 + 1 个完整示例服务 |
| 安全防护层数 | 7 层（限流 ×2 + CORS + 响应头 + 路径防护 + 输入校验 + bcrypt） |
| 操作日志类型 | 11 种操作类型完整审计 |
| TypeScript 类型 | 1 个完整类型定义文件（30+ interfaces/types） |
| 测试覆盖维度 | 8 个测试套件 × 25+ 测试用例 |
| 接入时长 | ≤ 5 分钟（一键运行或模块化集成） |

## 1. 何时使用本 Skill

### 1.1 触发条件

以下场景应使用本 skill：
- 需要实现管理员登录功能
- 需要多角色权限控制（admin/operator/viewer）
- 需要操作日志记录和审计追踪
- 需要安全防护（频率限制、路径遍历防护、安全响应头）
- 用户提到"登录"、"认证"、"权限"、"JWT"、"RBAC" 等关键词

以下场景不应使用本 skill：
- 无状态 API 不需要认证 —— 直接开放接口
- 需要 OAuth2 社交登录 —— 本 skill 不含第三方登录
- 需要 Session 认证 —— 本 skill 使用 JWT 无状态方案
- 微服务间内部调用 —— 建议用 mTLS 或 API Key

### 1.2 前置约束

1. 先读 [`references/jwt-auth.md`](references/jwt-auth.md)，理解 JWT 认证流程
2. 角色定义参考 [`references/rbac.md`](references/rbac.md)，默认 admin > operator > viewer
3. 密码策略参考 [`references/account-management.md`](references/account-management.md)
4. **密码必须 bcrypt 哈希存储**，禁止明文，SALT_ROUNDS ≥ 12
5. **JWT Secret 至少 32 字符**，建议 64 字符随机字符串
6. **登录接口必须启用频率限制**，建议 15分钟/5次
7. **所有写操作必须记录操作日志**

## 2. 模块与命令导航

### 2.1 模块地图

| 大模块 | 解决什么问题 | 参考文档 | 可运行代码 |
|------|------------|---------|-----------|
| JWT 认证 | Token 签发、验证、刷新 | [`references/jwt-auth.md`](references/jwt-auth.md) | [`references/auth-middleware.js`](references/auth-middleware.js) |
| RBAC 权限 | 角色定义、权限中间件、权限矩阵 | [`references/rbac.md`](references/rbac.md) | [`references/role-guard.js`](references/role-guard.js) |
| 多账户管理 | 账户 CRUD、密码策略、登录处理 | [`references/account-management.md`](references/account-management.md) | [`references/account-manager.js`](references/account-manager.js) |
| 登录处理 | 单密码/多账户双模式登录 + Token 签发 | — | [`references/login-handler.js`](references/login-handler.js) |
| 安全防护 | 频率限制、CORS、响应头、路径遍历防护 | [`references/security.md`](references/security.md) | [`references/security-middleware.js`](references/security-middleware.js) |
| 操作日志 | 日志记录、查询、统计、审计追踪 | [`references/audit-log.md`](references/audit-log.md) | [`references/audit-logger.js`](references/audit-logger.js) |
| 故障排查 | 常见认证问题、权限问题、安全问题的解决方案 | [`references/troubleshooting.md`](references/troubleshooting.md) | — |
| API 协议 | Token 结构、接口规范、错误码枚举 | [`references/data-contract.md`](references/data-contract.md) | — |
| TypeScript 类型 | 账户/JWT/RBAC/日志/安全类型定义 | — | [`types/index.d.ts`](types/index.d.ts) |
| 完整示例 | 一键可运行的认证服务器 | — | [`examples/basic-auth-server.js`](examples/basic-auth-server.js) |

- `references/` - 参考文档与运行脚本
- `examples/` - 使用示例，演示完整数据管线
- `tests/` - 测试固件（JSON格式）

**可选扩展模块**（按需加载）：

| 扩展模块 | 适用场景 | 参考 |
|----------|----------|------|
| 前端集成 | React/Vue Axios 拦截器、Token 存储策略 | 见[2.6 前端集成指南](#26-前端集成指南) |
| Docker 部署 | 容器化部署 + PM2 进程管理 + Nginx | 见[2.7 部署方案](#27-部署方案可选) |
| OAuth2 社交登录 | Google/GitHub 第三方登录 | 见[2.8 可选扩展](#28-可选扩展) |
| Session 认证 | 需要服务端状态的场景 | 见[2.8 可选扩展](#28-可选扩展) |
| 数据库迁移 | JSON → SQLite/PostgreSQL | 见[2.8 可选扩展](#28-可选扩展) |

### 2.2 JWT 认证模块

**必读 reference**：[`references/jwt-auth.md`](references/jwt-auth.md)

| 功能 | 说明 |
|------|------|
| Token 签发 | `jwt.sign()` 生成 Token，支持自定义过期时间 |
| Token 验证 | `jwt.verify()` 验证 Token 有效性 |
| Token 刷新 | 过期前重新签发，保持用户登录状态 |

**路由提醒**：Token 存储在请求头 `x-admin-token` 中，不是 `Authorization: Bearer`。验证失败返回 401，过期返回专属提示"登录已过期，请重新登录"。可运行代码见 [`references/auth-middleware.js`](references/auth-middleware.js)。

### 2.3 RBAC 权限模块

**必读 reference**：[`references/rbac.md`](references/rbac.md)

| 角色 | 权限范围 | 适用场景 |
|------|----------|----------|
| admin | 全部权限，含用户管理、系统配置、数据删除 | 系统管理员 |
| operator | 数据读写，不可删除核心数据、不可管理用户 | 内容运营 |
| viewer | 只读访问 | 数据查看者 |

**路由提醒**：权限中间件必须在 `authMiddleware` 之后使用（依赖 `req.adminInfo.role`）。角色从低到高为 viewer < operator < admin，admin 拥有所有权限。可运行代码见 [`references/role-guard.js`](references/role-guard.js)。

### 2.4 安全防护模块

**必读 reference**：[`references/security.md`](references/security.md)

| 防护措施 | 默认配置 | 说明 |
|----------|---------|------|
| 登录频率限制 | 15分钟/5次 | 防止暴力破解 |
| API 全局限流 | 1分钟/100次 | 防止恶意请求 |
| CORS 白名单 | 配置文件指定 | 限制跨域访问 |
| 安全响应头 | X-Content-Type 等 | 防止常见攻击 |
| 路径遍历防护 | safeResolve() | 防止目录穿越 |

**路由提醒**：全局中间件（securityHeaders、CORS、apiLimiter）用 `app.use()`，登录接口专用 `loginLimiter` 必须用 `app.post('/login', loginLimiter, handler)`。可运行代码见 [`references/security-middleware.js`](references/security-middleware.js)。

### 2.5 操作日志模块

**必读 reference**：[`references/audit-log.md`](references/audit-log.md)

| 操作类型 | 说明 | 触发场景 |
|----------|------|----------|
| LOGIN | 登录成功 | 用户登录 |
| LOGIN_FAILED | 登录失败 | 密码错误 |
| PASSWORD_CHANGE | 修改密码 | 管理员改密 |
| PROJECT_ADD/UPDATE/DELETE | 项目操作 | 数据变更 |
| BACKUP_CREATE/RESTORE | 备份操作 | 数据备份 |

**路由提醒**：日志文件位于 `logs/operations.json`，最大 5000 条自动截断。使用原子写入（先写 .tmp 再 rename）防止并发写坏。可运行代码见 [`references/audit-logger.js`](references/audit-logger.js)。

### 2.6 前端集成指南

**必读 reference**：参考 [`references/login-handler.js`](references/login-handler.js) 中的 Axios 拦截器注释

| 集成点 | 方案 | 说明 |
|--------|------|------|
| Token 存储 | HttpOnly Cookie（推荐）或 localStorage | Cookie 防 XSS，localStorage 更简单 |
| 请求拦截 | Axios 拦截器自动添加 `x-admin-token` 头 | 无需手动携带 Token |
| 401 处理 | 响应拦截器自动跳转登录页 | Token 过期/无效时清除并跳转 |
| Token 刷新 | 在过期前调用 `/api/auth/refresh` | 保持用户登录状态 |
| 角色守卫 | 前端路由守卫校验 `user.role` | 无权限页面直接重定向 |

**路由提醒**：前端 `x-admin-token` 请求头必须与后端 `authMiddleware` 提取的头名一致。生产环境建议使用 HttpOnly Cookie 替代 localStorage 以防御 XSS。

### 2.7 部署方案（可选）

| 部署方式 | 适用场景 | 关键配置 |
|----------|----------|----------|
| 直接运行 | 开发环境 | `node examples/basic-auth-server.js` |
| PM2 进程管理 | 生产环境单机 | `pm2 start examples/basic-auth-server.js --name auth-server` |
| Docker Compose | 容器化部署 | Node.js 18+ 镜像 + 挂载 .env + 数据卷 |
| Nginx 反向代理 | 生产环境 | `proxy_pass http://127.0.0.1:3456` + SSL 证书 |

**路由提醒**：生产环境必须设置 HTTPS（Nginx 终止 SSL），`ALLOWED_ORIGINS` 限制为实际域名，JWT_SECRET 使用强随机密钥并通过环境变量注入（禁止硬编码）。

### 2.8 可选扩展

| 扩展方向 | 难度 | 说明 |
|----------|:--:|------|
| OAuth2 社交登录 | 中 | 集成 passport.js，支持 Google / GitHub 第三方登录 |
| Session 认证 | 低 | 用 express-session + Redis 替代 JWT，适用于需要服务端注销的场景 |
| 数据库迁移 | 中 | 从 JSON 文件迁移到 SQLite/PostgreSQL + Prisma/Sequelize ORM |
| MFA 多因素认证 | 高 | TOTP 二次验证（speakeasy + qrcode） |
| API Key 管理 | 中 | 为第三方 API 调用生成独立 Key，支持权限范围限制 |

## 3. 标准流程

1. **确认需求**：是否需要多账户？需要哪些角色？需要哪些安全防护？
2. **读取文档**：阅读 [`references/jwt-auth.md`](references/jwt-auth.md) 理解认证流程
3. **定义角色**：参考 [`references/rbac.md`](references/rbac.md) 定义角色和权限
4. **配置安全**：参考 [`references/security.md`](references/security.md) 配置防护措施
5. **生成代码**：基于文档模板生成完整的认证系统
6. **配置环境**：设置 `.env` 文件中的 `JWT_SECRET` 和 `ADMIN_PASSWORD`

## 4. 常见错误

| 错误 | 后果 | 正确做法 |
|------|------|---------|
| 密码明文存储 | 数据库泄露导致密码暴露 | 使用 bcrypt 哈希，SALT_ROUNDS ≥ 12 |
| JWT Secret 太短 | 容易被暴力破解 | 至少 32 字符，建议 64 字符随机字符串 |
| 不限制登录频率 | 暴力破解攻击 | 15分钟内最多5次尝试 |
| Token 有效期过长 | 泄露后长期有效 | 不超过 24 小时 |
| 不记录操作日志 | 出问题无法追溯 | 所有写操作必须记录 |
| 角色权限混乱 | 越权操作 | 明确定义角色权限矩阵 |
| 不校验路径 | 路径遍历攻击 | 使用 safeResolve() 校验 |
| CORS 通配符 `*` | 任意域名可调用 API | 配置 ALLOWED_ORIGINS 白名单 |
| 密码用 MD5/SHA256 | 彩虹表秒破 | 只用 bcrypt，SALT_ROUNDS=12 |
| 并发写日志 | 文件损坏 | 使用原子写入（先写 .tmp 再 rename） |
| 日志记录所有请求 | 文件暴涨 50MB+ | 只记录写操作（POST/PUT/DELETE），上限 5000 条 |

## 5. 参数调优速查

### 单参数速查

| 参数 | 默认值 | 说明 | 何时调参 |
|------|--------|------|---------|
| SALT_ROUNDS | 12 | bcrypt 哈希轮数 | 安全要求更高时增大到 14 |
| Token 有效期 | 24h | JWT Token 过期时间 | 安全要求高时缩短到 2h |
| 登录频率限制 | 15分钟/5次 | 登录尝试限制 | 安全要求高时改为 15分钟/3次 |
| API 限流 | 1分钟/100次 | API 请求限制 | 高并发时适当增大 |
| 日志最大条数 | 5000 | 操作日志上限 | 磁盘空间充足时增大 |
| 密码最小长度 | 8 字符 | 密码策略 | 安全要求高时改为 12 字符 |

### 场景预设配置

| 场景 | SALT | Token | 登录限流 | API 限流 | 密码长度 | 适用 |
|------|:----:|:-----:|:--------:|:--------:|:--------:|------|
| 开发环境 | 10 | 7d | 关闭 | 关闭 | 6 | 本地调试 |
| 标准生产 | 12 | 24h | 15min/5次 | 1min/100次 | 8 | 一般后台 |
| 高安全 | 14 | 2h | 15min/3次 | 1min/50次 | 12 | 金融/医疗 |
| 高并发 | 12 | 24h | 15min/5次 | 1min/500次 | 8 | 大量用户 |

## 6. Quick Start

### 方式一：一键运行示例服务器

```bash
# 1. 安装依赖
npm install express bcryptjs jsonwebtoken express-rate-limit cors

# 2. 生成 JWT 密钥并启动
set JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
set ADMIN_PASSWORD=your-secure-password
node examples/basic-auth-server.js

# 3. 测试登录
curl -X POST http://localhost:3456/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"your-secure-password"}'
```

### 方式二：模块化集成到现有项目

```bash
# 安装依赖
npm install express bcryptjs jsonwebtoken express-rate-limit cors

# 配置环境变量（.env）
cat > .env << EOF
ADMIN_PASSWORD=your-secure-password
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
ADMIN_PORT=3456
ALLOWED_ORIGINS=http://localhost:5173
EOF
```

```javascript
// 按需导入模块
import { authMiddleware, signToken } from './references/auth-middleware.js'
import { requireRole } from './references/role-guard.js'
import { securityHeaders, loginLimiter, apiLimiter, createCors } from './references/security-middleware.js'
import { writeLog, queryLogs } from './references/audit-logger.js'

const app = express()

// 全局安全防护
app.use(securityHeaders)
app.use(createCors(ALLOWED_ORIGINS))
app.use('/api', apiLimiter)

// 登录接口
app.post('/api/auth/login', loginLimiter, handleLogin)

// 受保护路由
app.get('/api/dashboard', authMiddleware, getDashboard)
app.delete('/api/users/:id', authMiddleware, requireRole('admin'), deleteUser)
app.put('/api/projects/:id', authMiddleware, requireRole('admin', 'operator'), updateProject)

app.listen(3456, () => console.log('Auth server running on :3456'))
```

## 7. 项目文件结构

```
admin-auth-system/
├── SKILL.md                        # 主文档（8 个 section，编号 0-7）
├── package.json                    # NPM 依赖清单与脚本
├── .gitignore                      # Git 忽略规则（node_modules/、.env、logs/ 等）
├── LICENSE                         # MIT 开源许可证
├── CHANGELOG.md                    # 版本变更日志
├── types/
│   └── index.d.ts                  # TypeScript 类型定义（30+ interfaces/types）
├── examples/
│   └── basic-auth-server.js        # 完整可运行认证服务器（ESM）
├── tests/
│   └── test-auth.test.js           # 集成测试套件（8 套件 × 25+ 用例）
└── references/
    ├── jwt-auth.md                 # JWT 认证文档（签发/验证/刷新）
    ├── auth-middleware.js          # JWT 认证可运行代码
    ├── rbac.md                     # RBAC 权限文档（3 级角色 + 权限矩阵）
    ├── role-guard.js               # RBAC 权限可运行代码
    ├── account-management.md       # 多账户管理文档
    ├── account-manager.js          # 账户 CRUD + 密码策略 + 统计（可运行）
    ├── login-handler.js            # 登录处理器（单密码/多账户双模式）
    ├── security.md                 # 安全防护文档（7 层防护）
    ├── security-middleware.js      # 安全防护可运行代码
    ├── audit-log.md                # 操作日志文档（11 种操作类型）
    ├── audit-logger.js             # 操作日志可运行代码（查询/统计/原子写入）
    ├── troubleshooting.md          # 故障排查（14 个常见问题）
    └── data-contract.md            # API 数据协议（15 个端点 + 错误码枚举）
```
