# 安全防护模块

## 功能概述

提供多层次安全防护，包括频率限制、CORS配置、安全响应头和路径遍历防护。

## 核心实现

### 登录频率限制

```javascript
import rateLimit from 'express-rate-limit'

/**
 * 登录频率限制
 * 每 IP 15分钟内最多尝试 5 次
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15分钟
  max: 5,                      // 最多5次
  message: { error: '登录尝试过多，请15分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip  // 按IP限制
})

/**
 * API 全局频率限制
 * 每分钟最多 100 次请求
 */
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,   // 1分钟
  max: 100,                    // 最多100次
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false
})
```

### 安全响应头

```javascript
/**
 * 安全响应头中间件
 * 设置常见的安全相关 HTTP 头
 */
function securityHeaders(req, res, next) {
  // 防止 MIME 类型嗅探
  res.setHeader('X-Content-Type-Options', 'nosniff')
  
  // 防止点击劫持
  res.setHeader('X-Frame-Options', 'DENY')
  
  // XSS 防护（旧版浏览器）
  res.setHeader('X-XSS-Protection', '1; mode=block')
  
  // 控制 Referer 头
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // 禁用不必要的浏览器功能
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  
  next()
}
```

### CORS 配置

```javascript
import cors from 'cors'

/**
 * 创建 CORS 中间件
 * @param {string[]} allowedOrigins - 允许的源列表
 */
function createCorsMiddleware(allowedOrigins) {
  return cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'x-admin-token'],
    maxAge: 86400  // 预检请求缓存24小时
  })
}

// 使用示例
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173']
app.use(createCorsMiddleware(ALLOWED_ORIGINS))
```

### 路径遍历防护

```javascript
import path from 'node:path'

/**
 * 安全路径解析 — 防止路径遍历攻击
 * @param {string} baseDir - 基础目录
 * @param {...string} segments - 路径片段
 * @returns {string} 安全的绝对路径
 * @throws {Error} 路径越界时抛出错误
 */
function safeResolve(baseDir, ...segments) {
  const resolved = path.resolve(baseDir, ...segments)
  const normalizedBase = path.resolve(baseDir)
  
  // 确保解析后的路径在基础目录内
  if (!resolved.startsWith(normalizedBase + path.sep) && resolved !== normalizedBase) {
    throw new Error('路径越界: ' + resolved)
  }
  
  return resolved
}
```

### 输入验证

```javascript
/**
 * 校验必填字段
 * @param {Object} body - 请求体
 * @param {...string} fields - 必填字段列表
 * @returns {string|null} 错误信息或null
 */
function requireFields(body, ...fields) {
  const missing = fields.filter(f => !body[f])
  if (missing.length > 0) {
    return `缺少必填字段：${missing.join(', ')}`
  }
  return null
}

/**
 * 校验 ID 格式
 * @param {string} id - 待校验的ID
 * @returns {boolean} 是否有效
 */
function isValidId(id) {
  return typeof id === 'string' && /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(id)
}
```

## 安全检查清单

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 密码哈希存储 | ✅ | 使用 bcrypt，SALT_ROUNDS=12 |
| JWT 密钥强度 | ✅ | 至少 32 字符，推荐 64 字符 |
| 登录频率限制 | ✅ | 15分钟/5次 |
| API 全局限流 | ✅ | 1分钟/100次 |
| CORS 白名单 | ✅ | 仅允许指定域名 |
| 路径遍历防护 | ✅ | safeResolve 校验 |
| 安全响应头 | ✅ | X-Content-Type, X-Frame 等 |
| 输入验证 | ✅ | 必填字段、格式校验 |

## 环境变量配置

```env
# CORS 允许的源（逗号分隔）
ALLOWED_ORIGINS=http://localhost:5173,https://admin.example.com

# JWT 密钥（至少32字符）
JWT_SECRET=<64字符随机字符串>

# 管理员密码
ADMIN_PASSWORD=<强密码>
```
