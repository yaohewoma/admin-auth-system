/**
 * JWT 认证中间件 — Token 签发、验证、刷新
 *
 * @module auth-middleware
 * @requires jsonwebtoken
 */

import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET
const TOKEN_EXPIRES = process.env.TOKEN_EXPIRES || '24h'

// ── Token 签发 ────────────────────────────────────────────────────────────

/**
 * 签发 JWT Token
 * @param {Object} payload - Token 负载数据（{ userId, userName, role }）
 * @param {string} [expiresIn='24h'] - 过期时间
 * @returns {string} 签发的 JWT Token
 */
function signToken(payload, expiresIn = TOKEN_EXPIRES) {
  return jwt.sign(
    { ...payload, iat: Math.floor(Date.now() / 1000) },
    JWT_SECRET,
    { expiresIn }
  )
}

// ── Token 验证中间件 ──────────────────────────────────────────────────────

/**
 * JWT 认证中间件
 *
 * 从请求头 `x-admin-token` 提取 Token 并验证。
 * 验证通过后将 decoded payload 挂载到 `req.adminInfo`。
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 *
 * @example
 *   app.get('/api/private', authMiddleware, handler)
 */
function authMiddleware(req, res, next) {
  const token = req.headers['x-admin-token']

  if (!token) {
    return res.status(401).json({ error: '未授权，请输入管理员密码' })
  }

  try {
    req.adminInfo = jwt.verify(token, JWT_SECRET)
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '登录已过期，请重新登录' })
    }
    return res.status(401).json({ error: '无效的认证令牌' })
  }
}

// ── Token 刷新 ────────────────────────────────────────────────────────────

/**
 * 刷新 Token 接口处理器
 *
 * 在 Token 过期前调用，基于当前 Token 中的用户信息重新签发。
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 *
 * @example
 *   app.post('/api/auth/refresh', authMiddleware, refreshTokenHandler)
 */
function refreshTokenHandler(req, res) {
  const { userId, userName, role } = req.adminInfo
  const newToken = signToken({ userId, userName, role })
  res.json({ token: newToken, message: 'Token 已刷新' })
}

// ── Token 负载结构（TypeScript 类型参考） ─────────────────────────────────
//
// interface TokenPayload {
//   userId: string      // 用户唯一标识
//   userName: string    // 用户显示名称
//   role: string        // 用户角色（admin/operator/viewer）
//   iat: number         // 签发时间戳
//   exp: number         // 过期时间戳（自动生成）
// }

export { signToken, authMiddleware, refreshTokenHandler }