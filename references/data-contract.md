# API 数据协议 — admin-auth-system

## 认证方式

所有需要认证的 API 请求必须携带 HTTP 请求头：

```
x-admin-token: <JWT Token>
```

## Token 结构

```typescript
interface TokenPayload {
  userId: string      // 用户唯一标识
  userName: string    // 用户显示名称
  role: string        // 用户角色：admin | operator | viewer
  iat: number         // 签发时间戳（Unix 秒）
  exp: number         // 过期时间戳（Unix 秒，自动生成）
}
```

## API 接口一览

| 方法 | 路径 | 认证 | 角色 | 说明 |
|------|------|:---:|------|------|
| POST | /api/auth/login | ❌ | — | 用户登录 |
| GET | /api/auth/verify | ✅ | 任意 | 验证 Token 有效性 |
| POST | /api/auth/change-password | ✅ | admin | 修改密码 |
| POST | /api/auth/refresh | ✅ | 任意 | 刷新 Token |
| GET | /api/dashboard | ✅ | 任意 | 仪表盘数据 |
| GET | /api/users | ✅ | admin | 用户列表 |
| POST | /api/users | ✅ | admin | 创建用户 |
| DELETE | /api/users/:id | ✅ | admin | 删除用户 |
| GET | /api/projects | ✅ | 任意 | 项目列表 |
| POST | /api/projects | ✅ | admin, operator | 创建项目 |
| PUT | /api/projects/:id | ✅ | admin, operator | 更新项目 |
| DELETE | /api/projects/:id | ✅ | admin | 删除项目 |
| GET | /api/logs | ✅ | 任意 | 操作日志（分页） |
| GET | /api/logs/summary | ✅ | 任意 | 日志统计摘要 |
| DELETE | /api/logs | ✅ | admin | 清空日志 |

## 通用响应格式

### 成功

```json
{
  "message": "操作成功",
  // ... 业务数据字段
}
```

### 错误

```json
{
  "error": "错误描述",
  // 可选字段（部分错误包含）
  "required": ["admin"],
  "current": "viewer"
}
```

## HTTP 状态码

| 状态码 | 含义 | 触发场景 |
|:----:|------|----------|
| 200 | OK | 请求成功 |
| 201 | Created | 资源创建成功 |
| 400 | Bad Request | 缺少必填字段 / 输入格式错误 |
| 401 | Unauthorized | Token 缺失 / 过期 / 无效 |
| 403 | Forbidden | 角色权限不足 / 密码错误 |
| 404 | Not Found | 资源不存在 |
| 429 | Too Many Requests | 频率限制触发 |

## 错误码枚举

| 错误信息 | 触发条件 |
|----------|----------|
| `未授权，请输入管理员密码` | 未携带 Token |
| `登录已过期，请重新登录` | Token 过期 |
| `无效的认证令牌` | Token 格式错误或签名无效 |
| `权限不足，请联系管理员` | 角色不在允许列表中 |
| `登录尝试过多，请 15 分钟后再试` | 登录频率超限 |
| `请求过于频繁，请稍后再试` | API 全局限流触发 |
| `账户或密码错误` | 登录凭证无效 |
| `路径越界` | 路径遍历攻击被拦截 |

## 登录请求/响应示例

### 请求

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "your-secure-password"
}
```

### 成功响应

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "admin",
    "name": "管理员",
    "role": "admin"
  },
  "message": "登录成功"
}
```

### 失败响应

```json
{
  "error": "账户或密码错误"
}
```

## 操作日志结构

```typescript
interface OperationLog {
  id: string           // UUID 唯一标识
  timestamp: string    // ISO 8601 时间戳
  action: string       // 操作类型（LOGIN / PROJECT_ADD 等）
  message: string      // 操作描述
  ip: string          // 操作者 IP
  admin: string       // 操作者角色
  // 以下为业务相关可选字段
  projectId?: string
  count?: number
  topicId?: number
}
```

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|:---:|--------|------|
| ADMIN_PASSWORD | ✅ | — | 管理员密码 |
| JWT_SECRET | ✅ | — | JWT 签名密钥（≥32 字符） |
| ADMIN_PORT | ❌ | 3456 | 服务端口 |
| ALLOWED_ORIGINS | ❌ | http://localhost:5173 | CORS 白名单（逗号分隔） |
| TOKEN_EXPIRES | ❌ | 24h | Token 过期时间 |
| MAX_LOGS | ❌ | 5000 | 操作日志最大条数 |