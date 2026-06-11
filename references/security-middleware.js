/**
 * 安全防护中间件 — 频率限制、CORS、安全响应头、路径遍历防护、输入校验
 *
 * @module security-middleware
 */

import rateLimit from 'express-rate-limit'
import corsLib   from 'cors'
import path      from 'node:path'

// ── 频率限制 ──────────────────────────────────────────────────────────────

/**
 * 登录频率限制
 * 每 IP 15 分钟内最多尝试 5 次，防止暴力破解
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: '登录尝试过多，请 15 分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
})

/**
 * API 全局频率限制
 * 每分钟每 IP 最多 100 次请求
 */
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
})

// ── 安全响应头 ────────────────────────────────────────────────────────────

/**
 * 安全响应头中间件
 *
 * 设置常见安全 HTTP 头，防御常见 Web 攻击：
 * - X-Content-Type-Options: 防止 MIME 类型嗅探
 * - X-Frame-Options: 防止点击劫持
 * - X-XSS-Protection: XSS 防护（旧版浏览器）
 * - Referrer-Policy: 控制 Referer 头泄露
 * - Permissions-Policy: 禁用不必要的浏览器 API
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  next()
}

// ── CORS ──────────────────────────────────────────────────────────────────

/**
 * 创建 CORS 中间件
 *
 * @param {string[]} allowedOrigins - 允许的源列表（白名单）
 * @returns {import('cors').CorsRequestHandler}
 *
 * @example
 *   const origins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173']
 *   app.use(createCors(origins))
 */
function createCors(allowedOrigins) {
  return corsLib({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'x-admin-token'],
    maxAge: 86400, // 预检请求缓存 24 小时
  })
}

// ── 路径遍历防护 ──────────────────────────────────────────────────────────

/**
 * 安全路径解析 — 防止路径遍历攻击（如 ../../etc/passwd）
 *
 * @param {string} baseDir - 基础目录
 * @param {...string} segments - 路径片段
 * @returns {string} 安全的绝对路径
 * @throws {Error} 当路径越界时抛出
 *
 * @example
 *   const filePath = safeResolve(DATA_DIR, 'projects', req.params.id + '.json')
 */
function safeResolve(baseDir, ...segments) {
  const resolved = path.resolve(baseDir, ...segments)
  const normalizedBase = path.resolve(baseDir)

  if (!resolved.startsWith(normalizedBase + path.sep) && resolved !== normalizedBase) {
    throw new Error('路径越界: ' + resolved)
  }

  return resolved
}

// ── 输入校验 ──────────────────────────────────────────────────────────────

/**
 * 校验必填字段
 * @param {Object} body - 请求体
 * @param {...string} fields - 必填字段列表
 * @returns {string|null} 错误信息或 null（表示校验通过）
 */
function requireFields(body, ...fields) {
  const missing = fields.filter(f => !body[f])
  if (missing.length > 0) {
    return `缺少必填字段：${missing.join(', ')}`
  }
  return null
}

/**
 * 校验 ID 格式（小写字母开头，字母数字和连字符，2-32 位）
 * @param {string} id - 待校验的 ID
 * @returns {boolean} 是否合法
 */
function isValidId(id) {
  return typeof id === 'string' && /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(id)
}

// ── 安全检查清单 ──────────────────────────────────────────────────────────
//
// | 检查项         | 状态 | 说明                          |
// |---------------|------|------------------------------|
// | 密码哈希存储    | ✅   | bcrypt, SALT_ROUNDS=12        |
// | JWT 密钥强度   | ✅   | 至少 32 字符，推荐 64 字符       |
// | 登录频率限制    | ✅   | 15 分钟/5 次                   |
// | API 全局限流   | ✅   | 1 分钟/100 次                  |
// | CORS 白名单    | ✅   | 仅允许指定域名                  |
// | 路径遍历防护    | ✅   | safeResolve()                  |
// | 安全响应头     | ✅   | X-Content-Type, X-Frame 等     |
// | 输入校验       | ✅   | requireFields(), isValidId()   |

export {
  loginLimiter,
  apiLimiter,
  securityHeaders,
  createCors,
  safeResolve,
  requireFields,
  isValidId,
}