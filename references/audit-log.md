# 操作日志模块

## 功能概述

记录所有关键操作，支持查询、筛选和统计分析，便于审计和问题追踪。

## 数据结构

```typescript
interface OperationLog {
  id: string           // UUID 唯一标识
  timestamp: string    // ISO 时间戳
  action: string       // 操作类型（如 LOGIN, PROJECT_UPDATE）
  message: string      // 操作描述
  ip: string          // 操作者 IP
  admin: string       // 操作者角色
  // 业务相关字段
  competitionId?: string
  track?: string
  tier?: string
  name?: string
  count?: number
}
```

## 核心实现

### 日志存储

```javascript
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const LOGS_DIR = path.join(__dirname, 'logs')
const LOG_FILE = path.join(LOGS_DIR, 'operations.json')
const MAX_LOGS = 5000  // 最大日志条数

/**
 * 确保日志目录存在
 */
function ensureLogDir() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true })
  }
}

/**
 * 读取日志列表
 * @returns {OperationLog[]} 日志数组
 */
function readLogs() {
  ensureLogDir()
  try {
    const raw = fs.readFileSync(LOG_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

/**
 * 写入操作日志
 * @param {Object} operation - 操作信息
 */
function writeLog(operation) {
  ensureLogDir()
  const logs = readLogs()
  
  logs.unshift({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...operation
  })
  
  // 限制日志数量
  if (logs.length > MAX_LOGS) {
    logs.length = MAX_LOGS
  }
  
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), 'utf-8')
}
```

### 请求信息提取

```javascript
/**
 * 提取请求者信息
 * @param {Object} req - Express 请求对象
 * @returns {Object} 包含 ip 和 admin 信息
 */
function getOperatorInfo(req) {
  return {
    ip: req.ip || req.socket.remoteAddress || 'unknown',
    admin: req.adminInfo?.role || 'unknown'
  }
}
```

### 日志查询接口

```javascript
/**
 * 获取日志列表（分页 + 筛选）
 */
app.get('/api/logs', authMiddleware, (req, res) => {
  const { page = '1', limit = '50', action } = req.query
  let logs = readLogs()
  
  // 按操作类型筛选
  if (action) {
    logs = logs.filter(l => l.action === action)
  }
  
  // 分页
  const pageNum = parseInt(page, 10)
  const limitNum = parseInt(limit, 10)
  const start = (pageNum - 1) * limitNum
  const paged = logs.slice(start, start + limitNum)
  
  res.json({
    logs: paged,
    total: logs.length,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(logs.length / limitNum)
  })
})
```

### 日志统计接口

```javascript
/**
 * 获取日志统计摘要
 */
app.get('/api/logs/summary', authMiddleware, (req, res) => {
  const logs = readLogs()
  const actionCounts = {}
  const today = new Date().toISOString().slice(0, 10)
  let todayCount = 0
  
  logs.forEach(l => {
    actionCounts[l.action] = (actionCounts[l.action] || 0) + 1
    if (l.timestamp?.startsWith(today)) todayCount++
  })
  
  res.json({
    total: logs.length,
    today: todayCount,
    byAction: actionCounts,
    latest: logs.slice(0, 5)
  })
})
```

## 操作类型定义

| 操作类型 | 说明 | 触发场景 |
|----------|------|----------|
| LOGIN | 登录成功 | 用户登录 |
| LOGIN_FAILED | 登录失败 | 密码错误 |
| PASSWORD_CHANGE | 修改密码 | 管理员改密 |
| CONFIG_UPDATE | 配置更新 | 修改系统配置 |
| PROJECT_ADD | 添加项目 | 新增项目 |
| PROJECT_UPDATE | 更新项目 | 编辑项目 |
| PROJECT_DELETE | 删除项目 | 删除项目 |
| PROJECTS_BATCH_DELETE | 批量删除 | 批量操作 |
| AWARDS_UPDATE | 更新获奖 | 修改获奖数据 |
| BACKUP_CREATE | 创建备份 | 手动备份 |
| BACKUP_RESTORE | 恢复备份 | 数据恢复 |
| LOGS_CLEAR | 清空日志 | 清理日志 |

## 使用示例

```javascript
// 记录登录成功
writeLog({
  action: 'LOGIN',
  message: `${user.name} 登录成功`,
  ...getOperatorInfo(req)
})

// 记录数据更新
writeLog({
  action: 'PROJECT_UPDATE',
  message: `更新项目「${project.title}」`,
  topicId: project.topicId,
  ...getOperatorInfo(req)
})

// 记录批量操作
writeLog({
  action: 'PROJECTS_BATCH_DELETE',
  message: `批量删除${removed.length}个项目`,
  count: removed.length,
  ...getOperatorInfo(req)
})
```

## 最佳实践

1. **所有写操作必须记录日志** - 便于审计和回溯
2. **记录足够的上下文** - 包含操作对象、操作者、时间
3. **限制日志数量** - 避免文件过大（建议 5000 条）
4. **敏感信息脱敏** - 不记录密码、Token 等
5. **定期归档** - 可按日期归档历史日志
