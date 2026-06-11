# 故障排查 — admin-auth-system

## 运行错误

### 1. JWT_SECRET 未设置

**现象**：
```
❌ 请设置环境变量 JWT_SECRET（至少64字符随机字符串）
```

**原因**：环境变量 `JWT_SECRET` 未设置或为空

**解决**：
```bash
# 生成安全密钥
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# 添加到 .env 文件
echo "JWT_SECRET=<生成的密钥>" >> .env
```

### 2. ADMIN_PASSWORD 未设置

**现象**：
```
❌ 请设置环境变量 ADMIN_PASSWORD，或创建 .env 文件
```

**原因**：环境变量 `ADMIN_PASSWORD` 未设置

**解决**：
```bash
# 添加到 .env 文件
echo "ADMIN_PASSWORD=your-secure-password" >> .env
```

### 3. bcrypt 哈希失败

**现象**：
```
Error: Illegal arguments: string, undefined
```

**原因**：密码哈希时传入了 undefined

**解决**：
```javascript
// 确保密码不为空
if (!password || password.length < 8) {
  return res.status(400).json({ error: '密码至少8个字符' })
}
const hash = bcrypt.hashSync(password, SALT_ROUNDS)
```

### 4. Token 验证失败

**现象**：
```json
{ "error": "登录已过期，请重新登录" }
```

**原因**：Token 已过期或无效

**解决**：
1. 检查 Token 是否过期（默认 24 小时）
2. 引导用户重新登录获取新 Token
3. 前端实现 Token 自动刷新机制

### 5. 路径遍历攻击被拦截

**现象**：
```json
{ "error": "非法的文件路径" }
```

**原因**：请求路径包含 `..` 尝试目录穿越

**解决**：
```javascript
// 使用 safeResolve() 校验路径
function safeResolve(baseDir, ...segments) {
  const resolved = path.resolve(baseDir, ...segments)
  const normalizedBase = path.resolve(baseDir)
  if (!resolved.startsWith(normalizedBase + path.sep)) {
    throw new Error('路径越界')
  }
  return resolved
}
```

## 权限问题

### 6. 403 权限不足

**现象**：
```json
{ "error": "权限不足，请联系管理员" }
```

**原因**：用户角色没有访问该资源的权限

**解决**：
1. 检查用户角色是否正确
2. 检查路由是否使用了正确的 `requireRole()` 中间件
3. 参考 [权限矩阵](./rbac.md#权限矩阵) 确认角色权限

### 7. 角色层级混乱

**现象**：operator 角色可以执行 admin 操作

**原因**：权限检查逻辑错误

**解决**：
```javascript
// 正确的权限检查
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const userRole = req.adminInfo?.role
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: '权限不足' })
    }
    next()
  }
}

// 使用示例
app.delete('/api/users/:id', authMiddleware, requireRole('admin'), deleteUser)
```

## 安全问题

### 8. 暴力破解攻击

**现象**：短时间内大量登录尝试

**原因**：登录频率限制未生效

**解决**：
```javascript
import rateLimit from 'express-rate-limit'

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15分钟
  max: 5,                      // 最多5次
  message: { error: '登录尝试过多，请15分钟后再试' }
})

app.post('/api/auth/login', loginLimiter, handleLogin)
```

### 9. CORS 跨域问题

**现象**：前端请求被浏览器拦截

**原因**：CORS 配置不允许前端域名

**解决**：
```javascript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'x-admin-token']
}))
```

### 10. 密码泄露风险

**现象**：日志中记录了明文密码

**原因**：操作日志记录了敏感信息

**解决**：
```javascript
// 错误做法
writeLog({ action: 'LOGIN', password: password })  // ❌

// 正确做法
writeLog({ action: 'LOGIN', message: '登录成功' })  // ✅
```

## 性能问题

### 11. 日志文件过大

**现象**：operations.json 文件超过 100MB

**原因**：日志没有限制数量

**解决**：
```javascript
const MAX_LOGS = 5000

function writeLog(operation) {
  const logs = readLogs()
  logs.unshift({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), ...operation })
  
  // 限制日志数量
  if (logs.length > MAX_LOGS) {
    logs.length = MAX_LOGS
  }
  
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2))
}
```

### 12. bcrypt 哈希太慢

**现象**：登录响应时间超过 1 秒

**原因**：SALT_ROUNDS 设置过高

**解决**：
```javascript
// SALT_ROUNDS = 12 是合理的选择
// 10 → ~100ms, 12 → ~300ms, 14 → ~1.5s
const SALT_ROUNDS = 12
```

## 数据问题

### 13. 账户数据丢失

**现象**：accounts.json 文件损坏

**原因**：并发写入导致文件损坏

**解决**：
```javascript
// 使用原子写入
function writeJson(filename, data) {
  const filePath = path.join(DATA_DIR, filename)
  const tempPath = filePath + '.tmp'
  
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2))
  fs.renameSync(tempPath, filePath)  // 原子操作
}
```

### 14. Token 无法刷新

**现象**：Token 过期后无法自动刷新

**原因**：没有实现 Token 刷新接口

**解决**：
```javascript
app.post('/api/auth/refresh', authMiddleware, (req, res) => {
  const { userId, userName, role } = req.adminInfo
  const newToken = signToken({ userId, userName, role }, JWT_SECRET, '24h')
  res.json({ token: newToken })
})
```
