# JWT 认证模块

## 功能概述

基于 JSON Web Token 的无状态认证方案，支持 Token 签发、验证和过期管理。

## 核心实现

### Token 签发

```javascript
import jwt from 'jsonwebtoken'

/**
 * 签发 JWT Token
 * @param {Object} payload - Token 负载数据
 * @param {string} secret - JWT 密钥
 * @param {string} expiresIn - 过期时间（如 '24h', '7d'）
 * @returns {string} 签发的 Token
 */
function signToken(payload, secret, expiresIn = '24h') {
  return jwt.sign(
    {
      ...payload,
      iat: Math.floor(Date.now() / 1000)
    },
    secret,
    { expiresIn }
  )
}
```

### Token 验证中间件

```javascript
/**
 * JWT 认证中间件
 * 从请求头 x-admin-token 提取并验证 Token
 */
function authMiddleware(req, res, next) {
  const token = req.headers['x-admin-token']
  
  if (!token) {
    return res.status(401).json({ error: '未授权，请输入管理员密码' })
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.adminInfo = decoded
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '登录已过期，请重新登录' })
    }
    return res.status(401).json({ error: '无效的认证令牌' })
  }
}
```

### Token 刷新

```javascript
/**
 * 刷新 Token（在 Token 过期前调用）
 * @param {Object} req - Express 请求对象
 * @param {Object} res - Express 响应对象
 */
function refreshToken(req, res) {
  const { userId, userName, role } = req.adminInfo
  const newToken = signToken({ userId, userName, role }, JWT_SECRET, '24h')
  res.json({ token: newToken, message: 'Token 已刷新' })
}
```

## 安全建议

| 项目 | 要求 |
|------|------|
| 密钥长度 | 至少 32 字符，推荐 64 字符随机字符串 |
| 过期时间 | 不超过 24 小时 |
| 存储位置 | 前端使用 HttpOnly Cookie 或 localStorage |
| 传输方式 | 仅通过 HTTPS 传输 |

## 生成安全密钥

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# OpenSSL
openssl rand -hex 64
```

## Token 负载结构

```typescript
interface TokenPayload {
  userId: string      // 用户唯一标识
  userName: string    // 用户显示名称
  role: string        // 用户角色（admin/operator/viewer）
  iat: number         // 签发时间戳
  exp: number         // 过期时间戳（自动生成）
}
```
