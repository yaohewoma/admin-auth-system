/**
 * admin-auth-system — 最小化完整认证服务器示例
 *
 * 功能：JWT 认证 + RBAC 权限 + 频率限制 + 操作日志
 * 运行：node examples/basic-auth-server.js
 * 依赖：npm install express bcryptjs jsonwebtoken express-rate-limit cors
 *
 * 环境变量（在 .env 或命令行设置）：
 *   ADMIN_PASSWORD  — 管理员密码（必填）
 *   JWT_SECRET      — JWT 签名密钥（必填，≥32 字符）
 *   ADMIN_PORT      — 服务端口（默认 3456）
 *   ALLOWED_ORIGINS — CORS 白名单，逗号分隔（默认 http://localhost:5173）
 */

// ── 依赖 ──────────────────────────────────────────────────────────────────
import express      from 'express'
import bcrypt       from 'bcryptjs'
import jwt          from 'jsonwebtoken'
import rateLimit    from 'express-rate-limit'
import corsLib      from 'cors'
import crypto       from 'node:crypto'
import fs           from 'node:fs'
import path         from 'node:path'
import { fileURLToPath } from 'node:url'

// ── 常量 ──────────────────────────────────────────────────────────────────
const __dirname  = path.dirname(fileURLToPath(import.meta.url))
const SALT_ROUNDS   = 12
const TOKEN_EXPIRES = '24h'
const LOGS_DIR      = path.join(__dirname, '..', 'logs')
const LOG_FILE      = path.join(LOGS_DIR, 'operations.json')
const MAX_LOGS      = 5000

const PORT           = parseInt(process.env.ADMIN_PORT, 10) || 3456
const JWT_SECRET     = process.env.JWT_SECRET
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173']

// ── 启动校验 ──────────────────────────────────────────────────────────────
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('❌ 请设置环境变量 JWT_SECRET（至少 32 字符随机字符串）')
  console.error('   node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"')
  process.exit(1)
}
if (!ADMIN_PASSWORD) {
  console.error('❌ 请设置环境变量 ADMIN_PASSWORD，或创建 .env 文件')
  process.exit(1)
}

// ── 工具函数 ──────────────────────────────────────────────────────────────

/** 确保日志目录存在 */
function ensureLogDir() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true })
  }
}

/** 读取操作日志 */
function readLogs() {
  ensureLogDir()
  try { return JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8')) }
  catch { return [] }
}

/** 写入操作日志（自动截断到 MAX_LOGS） */
function writeLog(operation) {
  ensureLogDir()
  const logs = readLogs()
  logs.unshift({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), ...operation })
  if (logs.length > MAX_LOGS) logs.length = MAX_LOGS
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), 'utf-8')
}

/** 提取请求者信息 */
function getOperatorInfo(req) {
  return { ip: req.ip || req.socket.remoteAddress || 'unknown', admin: req.adminInfo?.role || 'unknown' }
}

/** 签发 JWT Token */
function signToken(payload, expiresIn = TOKEN_EXPIRES) {
  return jwt.sign({ ...payload, iat: Math.floor(Date.now() / 1000) }, JWT_SECRET, { expiresIn })
}

/** 密码哈希 */
function hashPassword(password) {
  return bcrypt.hashSync(password, SALT_ROUNDS)
}

/** 验证密码 */
function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash)
}

// ── 中间件 ────────────────────────────────────────────────────────────────

/** JWT 认证中间件 — 从 x-admin-token 请求头提取并验证 Token */
function authMiddleware(req, res, next) {
  const token = req.headers['x-admin-token']
  if (!token) return res.status(401).json({ error: '未授权，请输入管理员密码' })
  try {
    req.adminInfo = jwt.verify(token, JWT_SECRET)
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: '登录已过期，请重新登录' })
    return res.status(401).json({ error: '无效的认证令牌' })
  }
}

/** RBAC 角色权限中间件 — 校验当前用户角色是否在允许列表中 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const userRole = req.adminInfo?.role
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: '权限不足，请联系管理员', required: allowedRoles, current: userRole })
    }
    next()
  }
}

/** 安全响应头中间件 */
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  next()
}

/** 登录频率限制 — 15 分钟内每 IP 最多 5 次 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: '登录尝试过多，请 15 分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
})

/** API 全局限流 — 每分钟每 IP 最多 100 次 */
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
})

// ── Express 应用 ──────────────────────────────────────────────────────────
const app = express()
app.use(express.json())

// 安全防护
app.use(securityHeaders)
app.use(corsLib({ origin: ALLOWED_ORIGINS, credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'x-admin-token'] }))
app.use('/api', apiLimiter)

// ── 路由：认证 ────────────────────────────────────────────────────────────

/** POST /api/auth/login — 用户登录 */
app.post('/api/auth/login', loginLimiter, (req, res) => {
  const { password } = req.body
  if (!password) return res.status(400).json({ error: '请输入密码' })

  // 验证密码（简化版：只验证主密码，多账户模式参考 references/account-management.md）
  const storedHash = hashPassword(ADMIN_PASSWORD)
  if (!verifyPassword(password, storedHash)) {
    writeLog({ action: 'LOGIN_FAILED', message: '登录失败', ...getOperatorInfo(req) })
    return res.status(403).json({ error: '密码错误' })
  }

  const user = { id: 'admin', name: '管理员', role: 'admin' }
  const token = signToken(user)
  writeLog({ action: 'LOGIN', message: `${user.name} 登录成功`, ...getOperatorInfo(req) })
  res.json({ token, user, message: '登录成功' })
})

/** GET /api/auth/verify — 验证 Token 有效性 */
app.get('/api/auth/verify', authMiddleware, (req, res) => {
  res.json({ valid: true, user: req.adminInfo })
})

// ── 路由：受保护资源 ──────────────────────────────────────────────────────

/** GET /api/dashboard — 仪表盘数据（所有认证用户可访问） */
app.get('/api/dashboard', authMiddleware, (req, res) => {
  res.json({
    message: `欢迎, ${req.adminInfo.name}`,
    role: req.adminInfo.role,
    stats: { projects: 3400, skills: 800, logs: readLogs().length },
  })
})

/** GET /api/projects — 查看项目列表（所有认证用户） */
app.get('/api/projects', authMiddleware, (req, res) => {
  res.json({ projects: [], total: 0 })
})

/** POST /api/projects — 创建项目（admin 和 operator） */
app.post('/api/projects', authMiddleware, requireRole('admin', 'operator'), (req, res) => {
  writeLog({ action: 'PROJECT_ADD', message: `创建项目「${req.body.name || '未命名'}」`, ...getOperatorInfo(req) })
  res.status(201).json({ message: '创建成功' })
})

/** DELETE /api/projects/:id — 删除项目（仅 admin） */
app.delete('/api/projects/:id', authMiddleware, requireRole('admin'), (req, res) => {
  writeLog({ action: 'PROJECT_DELETE', message: `删除项目 #${req.params.id}`, ...getOperatorInfo(req) })
  res.json({ message: '删除成功' })
})

/** GET /api/logs — 查看操作日志（所有认证用户） */
app.get('/api/logs', authMiddleware, (req, res) => {
  const { page = '1', limit = '50', action } = req.query
  let logs = readLogs()
  if (action) logs = logs.filter(l => l.action === action)
  const pageNum = parseInt(page, 10), limitNum = parseInt(limit, 10)
  const paged = logs.slice((pageNum - 1) * limitNum, pageNum * limitNum)
  res.json({ logs: paged, total: logs.length, page: pageNum, limit: limitNum, totalPages: Math.ceil(logs.length / limitNum) })
})

// ── 启动 ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🔐 Admin Auth Server running on http://localhost:${PORT}`)
  console.log(`   Login: POST http://localhost:${PORT}/api/auth/login`)
  console.log(`   Dashboard: GET http://localhost:${PORT}/api/dashboard`)
})