# 多账户管理模块

## 功能概述

支持多账户系统，包含账户CRUD、密码策略和账户配置管理。

## 数据结构

### 账户对象

```typescript
interface Account {
  id: string           // 账户唯一标识（如用户名）
  name: string         // 显示名称
  role: 'admin' | 'operator' | 'viewer'  // 角色
  passwordHash: string // bcrypt 哈希后的密码
  createdAt: string    // 创建时间 ISO 格式
  lastLogin?: string   // 最后登录时间
}
```

### 管理员配置

```typescript
interface AdminConfig {
  passwordHash: string // 主密码哈希
  port: number         // 服务端口
}
```

## 核心实现

### 密码哈希工具

```javascript
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

/**
 * 生成密码哈希
 * @param {string} password - 明文密码
 * @returns {string} bcrypt 哈希
 */
function hashPassword(password) {
  return bcrypt.hashSync(password, SALT_ROUNDS)
}

/**
 * 验证密码
 * @param {string} password - 明文密码
 * @param {string} hash - 存储的哈希
 * @returns {boolean} 是否匹配
 */
function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash)
}
```

### 账户管理接口

```javascript
/**
 * 获取账户列表
 * @returns {Account[]} 账户数组
 */
function getAccounts() {
  const accounts = readJson('accounts.json')
  return Array.isArray(accounts) ? accounts : []
}

/**
 * 根据ID查找账户
 * @param {string} id - 账户ID
 * @returns {Account|null} 账户对象或null
 */
function findAccount(id) {
  const accounts = getAccounts()
  return accounts.find(a => a.id === id) || null
}

/**
 * 创建新账户
 * @param {Object} accountData - 账户数据
 * @returns {Account} 创建的账户
 */
function createAccount({ id, name, role, password }) {
  const accounts = getAccounts()
  
  if (accounts.find(a => a.id === id)) {
    throw new Error('账户已存在')
  }
  
  const newAccount = {
    id,
    name,
    role: role || 'viewer',
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString()
  }
  
  accounts.push(newAccount)
  writeJson('accounts.json', accounts)
  
  return { ...newAccount, passwordHash: undefined }
}
```

### 登录处理

```javascript
/**
 * 处理登录请求
 * 支持多账户（用户名+密码）和单密码模式
 */
function handleLogin(req, res) {
  const { username, password } = req.body
  
  if (!password) {
    return res.status(400).json({ error: '请输入密码' })
  }
  
  let user = { id: 'admin', name: '管理员', role: 'admin' }
  
  // 多账户模式
  if (username) {
    const account = findAccount(username)
    if (!account || !verifyPassword(password, account.passwordHash)) {
      writeLog({ action: 'LOGIN_FAILED', message: `登录失败: ${username}` })
      return res.status(403).json({ error: '账户或密码错误' })
    }
    user = { id: account.id, name: account.name, role: account.role }
  } else {
    // 单密码模式（主密码）
    const config = getAdminConfig()
    if (!verifyPassword(password, config.passwordHash)) {
      writeLog({ action: 'LOGIN_FAILED', message: '主密码验证失败' })
      return res.status(403).json({ error: '密码错误' })
    }
  }
  
  const token = signToken(user, JWT_SECRET, '24h')
  writeLog({ action: 'LOGIN', message: `${user.name} 登录成功` })
  
  res.json({ token, user, message: '登录成功' })
}
```

## API 接口

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | /api/auth/login | 公开 | 登录 |
| GET | /api/auth/verify | 认证 | 验证Token |
| POST | /api/auth/change-password | admin | 修改密码 |
| GET | /api/admin-config | 认证 | 获取配置 |
| PUT | /api/admin-config | admin | 更新配置 |

## 密码策略

| 项目 | 要求 |
|------|------|
| 最小长度 | 8 字符 |
| 存储方式 | bcrypt 哈希（SALT_ROUNDS=12） |
| 主密码 | 环境变量 ADMIN_PASSWORD |
| JWT密钥 | 环境变量 JWT_SECRET（≥32字符） |
