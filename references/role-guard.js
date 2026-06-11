/**
 * RBAC 角色权限中间件 — 角色校验、权限检查、资源所有权
 *
 * @module role-guard
 */

// ── 角色定义 ──────────────────────────────────────────────────────────────
//
// | 角色     | 权限范围                         | 适用场景       |
// |---------|----------------------------------|---------------|
// | admin   | 全部权限，含用户管理、系统配置、数据删除 | 系统管理员       |
// | operator| 数据读写，不可删除核心数据、不可管理用户  | 内容运营        |
// | viewer  | 只读访问                          | 数据查看者       |

// ── 权限矩阵 ──────────────────────────────────────────────────────────────

const ROLE_PERMISSIONS = {
  admin:    ['*'],                                          // 所有权限
  operator: ['read', 'write', 'export', 'log:read'],        // 读写 + 导出 + 查看日志
  viewer:   ['read', 'export', 'log:read'],                 // 只读 + 导出 + 查看日志
}

// ── 核心中间件 ────────────────────────────────────────────────────────────

/**
 * 角色权限验证中间件
 *
 * 校验当前用户角色是否在允许列表中。
 * 必须在 `authMiddleware` 之后使用（依赖 `req.adminInfo.role`）。
 *
 * @param {...string} allowedRoles - 允许的角色列表
 * @returns {Function} Express 中间件
 *
 * @example
 *   // 仅管理员可访问
 *   app.delete('/api/users/:id', authMiddleware, requireRole('admin'), deleteUser)
 *
 *   // 管理员和运营可访问
 *   app.put('/api/projects/:id', authMiddleware, requireRole('admin', 'operator'), updateProject)
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const userRole = req.adminInfo?.role

    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: '权限不足，请联系管理员',
        required: allowedRoles,
        current: userRole,
      })
    }

    next()
  }
}

// ── 辅助函数 ──────────────────────────────────────────────────────────────

/**
 * 检查用户是否有指定权限
 * @param {Object} userInfo - 用户信息对象（{ role }）
 * @param {string} permission - 需要的权限（如 'write', 'export', 'log:read'）
 * @returns {boolean} 是否有权限
 */
function hasPermission(userInfo, permission) {
  const permissions = ROLE_PERMISSIONS[userInfo.role] || []
  return permissions.includes('*') || permissions.includes(permission)
}

/**
 * 资源所有权校验中间件
 *
 * 非管理员用户只能操作自己的资源。
 *
 * @param {Function} getResourceOwner - 获取资源所有者 ID 的异步函数，接收 req 参数
 * @returns {Function} Express 中间件
 *
 * @example
 *   const getOwner = async (req) => (await findProject(req.params.id)).ownerId
 *   app.put('/api/projects/:id', authMiddleware, requireOwnerOrAdmin(getOwner), updateProject)
 */
function requireOwnerOrAdmin(getResourceOwner) {
  return async (req, res, next) => {
    const { userId, role } = req.adminInfo

    // 管理员直接通过
    if (role === 'admin') return next()

    // 校验资源所有权
    const ownerId = await getResourceOwner(req)
    if (ownerId !== userId) {
      return res.status(403).json({ error: '只能操作自己的资源' })
    }

    next()
  }
}

// ── 权限矩阵速查表 ────────────────────────────────────────────────────────
//
// | 操作       | admin | operator | viewer |
// |-----------|-------|----------|--------|
// | 查看数据    | ✅    | ✅       | ✅     |
// | 编辑数据    | ✅    | ✅       | ❌     |
// | 删除数据    | ✅    | ❌       | ❌     |
// | 用户管理    | ✅    | ❌       | ❌     |
// | 系统配置    | ✅    | ❌       | ❌     |
// | 备份恢复    | ✅    | ❌       | ❌     |
// | 查看日志    | ✅    | ✅       | ✅     |
// | 清空日志    | ✅    | ❌       | ❌     |

export { requireRole, hasPermission, requireOwnerOrAdmin, ROLE_PERMISSIONS }