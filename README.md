# admin-auth-system

> **一句话**：JWT + RBAC + 操作日志，5 分钟接入

Express.js 后台认证系统，提供开箱即用的 JWT 认证、三级 RBAC 角色权限、安全防护和操作日志审计。

## 快速开始

```bash
# 安装依赖
npm install express bcryptjs jsonwebtoken express-rate-limit cors

# 启动服务
set JWT_SECRET=your_64_char_random_secret
set ADMIN_PASSWORD=admin123
node examples/basic-server.js
```

## 模块地图

| 目录/文件 | 说明 |
|-----------|------|
| `SKILL.md` | Skill 主文档 |
| `examples/` | 完整 Express 认证服务示例 |
| `references/` | 参考文档（JWT 认证、RBAC、安全防护、操作日志等） |
| `tests/` | 测试用例 |
| `CHANGELOG.md` | 变更日志 |

## 核心能力

- JWT 认证 + bcrypt 密码哈希（SALT_ROUNDS ≥ 12）
- 三级角色权限：admin / operator / viewer
- 安全响应头 + CORS 白名单 + 频率限制
- 操作日志审计（支持查询和导出）
- 中间件可独立复用

## 适用场景

- 管理后台快速搭建
- 需要细粒度权限控制的 API
- 需要操作审计的合规系统

## GitHub

https://github.com/yaohewoma/admin-auth-system