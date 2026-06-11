# RBAC 权限模块

## 功能概述

基于角色的访问控制（Role-Based Access Control），支持多角色定义和细粒度权限管理。

## 角色定义

| 角色 | 权限范围 | 适用场景 |
|------|----------|----------|
| admin | 全部权限，含用户管理、系统配置、数据删除 | 系统管理员 |
| operator | 数据读写，不可删除核心数据、不可管理用户 | 内容运营 |
| viewer | 只读访问 | 数据查看者 |

## 核心实现

### 角色权限中间件

```javascript
/**
 * 角色权限验证中间件
 * @param {...string} allowedRoles - 允许的角色列表
 * @returns {Function} Express 中间件
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const userRole = req.adminInfo?.role
    
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        error: '权限不足，请联系管理员',
        required: allowedRoles,
        current: userRole
      })
    }
    
    next()
  }
}
```

### 权限检查工具

```javascript
/**
 * 检查用户是否有指定权限
 * @param {Object} userInfo - 用户信息对象
 * @param {string} permission - 需要的权限
 * @returns {boolean} 是否有权限
 */
function hasPermission(userInfo, permission) {
  const rolePermissions = {
    admin: ['*'],  // 所有权限
    operator: ['read', 'write', 'export'],
    viewer: ['read', 'export']
  }
  
  const permissions = rolePermissions[userInfo.role] || []
  return permissions.includes('*') || permissions.includes(permission)
}
```

### 资源所有权检查

```javascript
/**
 * 检查用户是否为资源所有者或管理员
 * @param {Function} getResourceOwner - 获取资源所有者ID的函数
 */
function requireOwnerOrAdmin(getResourceOwner) {
  return async (req, res, next) => {
    const { userId, role } = req.adminInfo
    
    // 管理员直接通过
    if (role === 'admin') return next()
    
    // 检查资源所有权
    const ownerId = await getResourceOwner(req)
    if (ownerId !== userId) {
      return res.status(403).json({ error: '只能操作自己的资源' })
    }
    
    next()
  }
}
```

## 使用示例

```javascript
// 仅管理员可访问
app.delete('/api/users/:id', 
  authMiddleware, 
  requireRole('admin'), 
  deleteUser
)

// 管理员和运营可访问
app.put('/api/projects/:id', 
  authMiddleware, 
  requireRole('admin', 'operator'), 
  updateProject
)

// 所有认证用户可访问
app.get('/api/dashboard', 
  authMiddleware, 
  getDashboard
)

// 组合权限检查
app.post('/api/projects', 
  authMiddleware, 
  requireRole('admin', 'operator'),
  (req, res, next) => {
    if (!hasPermission(req.adminInfo, 'write')) {
      return res.status(403).json({ error: '需要写入权限' })
    }
    next()
  },
  createProject
)
```

## 权限矩阵

| 操作 | admin | operator | viewer |
|------|-------|----------|--------|
| 查看数据 | ✅ | ✅ | ✅ |
| 编辑数据 | ✅ | ✅ | ❌ |
| 删除数据 | ✅ | ❌ | ❌ |
| 用户管理 | ✅ | ❌ | ❌ |
| 系统配置 | ✅ | ❌ | ❌ |
| 备份恢复 | ✅ | ❌ | ❌ |
| 查看日志 | ✅ | ✅ | ✅ |
| 清空日志 | ✅ | ❌ | ❌ |
