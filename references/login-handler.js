/**
 * 登录处理模块 — 单密码模式 + 多账户模式 + Token 签发
 *
 * @module login-handler
 */

import jwt from 'jsonwebtoken'
import { verifyPassword, findAccount } from './account-manager.js'
import { writeLog, getOperatorInfo } from './audit-logger.js'

const JWT_SECRET   = process.env.JWT_SECRET
const TOKEN_EXPIRES = process.env.TOKEN_EXPIRES || '24h'
const MAX_FAILED_ATTEMPTS = parseInt(process.env.MAX_FAILED_ATTEMPTS, 10) || 5

// ── Token 签发 ────────────────────────────────────────────────────────────

/**
 * 签发 JWT Token（内部函数）
 * @param {Object} user - { id, name, role }
 * @returns {string} JWT Token
 */
function signToken(user, expiresIn = TOKEN_EXPIRES) {
  return jwt.sign(
    { userId: user.id, userName: user.name, role: user.role, iat: Math.floor(Date.now() / 1000) },
    JWT_SECRET,
    { expiresIn }
  )
}

// ── 登录处理器 ────────────────────────────────────────────────────────────

/**
 * 创建登录处理器（支持单密码模式和多账户模式）
 *
 * 模式 1：单密码模式 — 仅传 password，校验环境变量 ADMIN_PASSWORD
 * 模式 2：多账户模式 — 传 username + password，查 accounts.json
 *
 * @param {Object} [options]
 * @param {Object} [options.accounts]   - 账户管理模块（需含 verifyPassword / findAccount / recordLogin）
 * @param {string} [options.adminPassword] - 单密码模式的主密码（默认 process.env.ADMIN_PASSWORD）
 * @returns {Function} Express 路由处理器
 *
 * @example
 *   import { createLoginHandler } from './references/login-handler.js'
 *   import * as accounts from './references/account-manager.js'
 *
 *   const handleLogin = createLoginHandler({ accounts })
 *   app.post('/api/auth/login', loginLimiter, handleLogin)
 */
function createLoginHandler({ accounts, adminPassword } = {}) {
  const masterHash = adminPassword
    ? require('bcryptjs').hashSync(adminPassword, 12)
    : null

  return (req, res) => {
    const { username, password } = req.body
    const opInfo = getOperatorInfo(req)

    // ── 输入校验 ────────────────────────────────────────────────────────
    if (!password) {
      return res.status(400).json({ error: '请输入密码' })
    }

    let user = null

    // ── 多账户模式：username 存在时按账户登录 ────────────────────────────
    if (username && accounts) {
      const account = accounts.findAccount(username)
      if (!account) {
        writeLog({ action: 'LOGIN_FAILED', message: `账户不存在: ${username}`, ...opInfo })
        return res.status(403).json({ error: '账户或密码错误' })
      }

      if (!accounts.verifyPassword(password, account.passwordHash)) {
        writeLog({ action: 'LOGIN_FAILED', message: `密码错误: ${username}`, ...opInfo })
        return res.status(403).json({ error: '账户或密码错误' })
      }

      accounts.recordLogin(username)
      user = { id: account.id, name: account.name, role: account.role }
    }
    // ── 单密码模式：只用 password ────────────────────────────────────────
    else if (masterHash) {
      const bcrypt = require('bcryptjs')
      if (!bcrypt.compareSync(password, masterHash)) {
        writeLog({ action: 'LOGIN_FAILED', message: '主密码验证失败', ...opInfo })
        return res.status(403).json({ error: '密码错误' })
      }

      user = { id: 'admin', name: '管理员', role: 'admin' }
    }
    else {
      return res.status(500).json({ error: '认证系统配置错误：未设置 ADMIN_PASSWORD' })
    }

    // ── 签发 Token ──────────────────────────────────────────────────────
    const token = signToken(user)
    writeLog({ action: 'LOGIN', message: `${user.name} 登录成功`, ...opInfo })

    res.json({
      token,
      user: { id: user.id, name: user.name, role: user.role },
      message: '登录成功',
    })
  }
}

// ── Axios 拦截器参考（前端）─────────────────────────────────────────────
//
// // Token 存储（推荐使用 HttpOnly Cookie，其次是 localStorage）
// const TOKEN_KEY = 'admin_token'
//
// // 请求拦截器 — 自动添加 Token
// axios.interceptors.request.use(config => {
//   const token = localStorage.getItem(TOKEN_KEY)
//   if (token) config.headers['x-admin-token'] = token
//   return config
// })
//
// // 响应拦截器 — Token 过期自动重新登录
// axios.interceptors.response.use(
//   response => response,
//   error => {
//     if (error.response?.status === 401) {
//       localStorage.removeItem(TOKEN_KEY)
//       window.location.href = '/login'
//     }
//     return Promise.reject(error)
//   }
// )

export { createLoginHandler, signToken }