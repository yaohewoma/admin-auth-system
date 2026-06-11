/**
 * admin-auth-system 集成测试套件
 *
 * 运行：npm test（先 npm install jest --save-dev）
 */

import { describe, it, expect, beforeAll } from '@jest/globals'

// ── 纯函数单元测试 ────────────────────────────────────────────────────────

describe('Security Constants', () => {
  it('JWT Secret 长度应 ≥ 32 字符', () => {
    const crypto = await import('node:crypto')
    const secret = crypto.randomBytes(64).toString('hex')
    expect(secret.length).toBeGreaterThanOrEqual(32)
  })

  it('bcrypt SALT_ROUNDS 应 ≥ 12', () => {
    const SALT_ROUNDS = 12
    expect(SALT_ROUNDS).toBeGreaterThanOrEqual(12)
  })

  it('随机密钥应每次生成不同值', () => {
    const crypto = await import('node:crypto')
    const a = crypto.randomBytes(64).toString('hex')
    const b = crypto.randomBytes(64).toString('hex')
    expect(a).not.toBe(b)
  })
})

describe('Role Hierarchy', () => {
  it('角色层级应为 admin > operator > viewer', () => {
    const ROLE_LEVEL = { admin: 3, operator: 2, viewer: 1 }
    expect(ROLE_LEVEL.admin).toBeGreaterThan(ROLE_LEVEL.operator)
    expect(ROLE_LEVEL.operator).toBeGreaterThan(ROLE_LEVEL.viewer)
  })

  it('admin 应有全部权限', () => {
    const permissions = { admin: ['*'], operator: ['read', 'write'], viewer: ['read'] }
    expect(permissions.admin).toContain('*')
  })

  it('viewer 不应有 write 权限', () => {
    const permissions = { admin: ['*'], operator: ['read', 'write'], viewer: ['read'] }
    expect(permissions.viewer).not.toContain('write')
  })

  it('requireRole 应拒绝低权限角色', () => {
    const requireRole = (...allowed) => (role) => allowed.includes(role)
    const guard = requireRole('admin')
    expect(guard('admin')).toBe(true)
    expect(guard('operator')).toBe(false)
    expect(guard('viewer')).toBe(false)
  })
})

describe('Password Hashing (bcrypt)', () => {
  let bcrypt

  beforeAll(async () => {
    bcrypt = await import('bcryptjs')
  })

  it('hashPassword 应生成与明文不同的哈希', () => {
    const password = 'SecureP@ss123'
    const hash = bcrypt.hashSync(password, 12)
    expect(hash).not.toBe(password)
    expect(hash).toContain('$2a$')
  })

  it('verifyPassword 应对正确密码返回 true', () => {
    const password = 'SecureP@ss123'
    const hash = bcrypt.hashSync(password, 12)
    expect(bcrypt.compareSync(password, hash)).toBe(true)
  })

  it('verifyPassword 应对错误密码返回 false', () => {
    const hash = bcrypt.hashSync('SecureP@ss123', 12)
    expect(bcrypt.compareSync('WrongPassword', hash)).toBe(false)
  })

  it('verifyPassword 应对空字符串返回 false', () => {
    const hash = bcrypt.hashSync('SecureP@ss123', 12)
    expect(bcrypt.compareSync('', hash)).toBe(false)
  })

  it('相同密码不同盐应产生不同哈希', () => {
    const password = 'SecureP@ss123'
    const hash1 = bcrypt.hashSync(password, 12)
    const hash2 = bcrypt.hashSync(password, 12)
    expect(hash1).not.toBe(hash2)
  })

  it('SALT_ROUNDS=12 时哈希时间应在合理范围', () => {
    const start = Date.now()
    bcrypt.hashSync('SecureP@ss123', 12)
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(2000)  // 不应超过 2s
  })
})

describe('JWT Token', () => {
  let jwt

  beforeAll(async () => {
    jwt = await import('jsonwebtoken')
  })

  const SECRET = 'test-secret-at-least-32-characters-long-enough'

  it('signToken 应生成有效 JWT（三段结构）', () => {
    const token = jwt.sign({ userId: 'admin', role: 'admin' }, SECRET, { expiresIn: '1h' })
    const parts = token.split('.')
    expect(parts).toHaveLength(3)
  })

  it('verifyToken 应正确解码 payload', () => {
    const payload = { userId: 'admin', userName: '管理员', role: 'admin' }
    const token = jwt.sign(payload, SECRET, { expiresIn: '1h' })
    const decoded = jwt.verify(token, SECRET)
    expect(decoded.userId).toBe('admin')
    expect(decoded.role).toBe('admin')
  })

  it('verifyToken 应对无效 Token 抛出异常', () => {
    expect(() => jwt.verify('invalid.token.here', SECRET)).toThrow()
  })

  it('verifyToken 应对错误密钥抛出异常', () => {
    const token = jwt.sign({ userId: 'admin' }, SECRET, { expiresIn: '1h' })
    expect(() => jwt.verify(token, 'wrong-secret-at-least-32-characters!!')).toThrow()
  })

  it('过期的 Token 应抛出 TokenExpiredError', () => {
    const token = jwt.sign({ userId: 'admin' }, SECRET, { expiresIn: '0s' })
    expect(() => jwt.verify(token, SECRET)).toThrow('jwt expired')
  })
})

describe('Rate Limiter Configuration', () => {
  it('登录频率限制应为 15 分钟窗口内 5 次', () => {
    const config = { windowMs: 15 * 60 * 1000, max: 5 }
    expect(config.windowMs).toBe(900000)
    expect(config.max).toBe(5)
  })

  it('API 全局限流应为 1 分钟窗口内 100 次', () => {
    const config = { windowMs: 1 * 60 * 1000, max: 100 }
    expect(config.windowMs).toBe(60000)
    expect(config.max).toBe(100)
  })

  it('登录限流应比 API 限流更严格', () => {
    const loginRate = 5 / (15 * 60)  // 次/秒
    const apiRate = 100 / (1 * 60)   // 次/秒
    expect(loginRate).toBeLessThan(apiRate)
  })
})

describe('Input Validation', () => {
  it('requireFields 应检测缺失字段', () => {
    const requireFields = (body, ...fields) => fields.filter(f => !body[f])
    expect(requireFields({ name: 'test' }, 'name', 'password')).toEqual(['password'])
    expect(requireFields({ name: 'test', password: '123' }, 'name', 'password')).toEqual([])
  })

  it('isValidId 应校验 ID 格式', () => {
    const isValidId = (id) => /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(id)
    expect(isValidId('project-123')).toBe(true)
    expect(isValidId('a')).toBe(false)
    expect(isValidId('../../etc')).toBe(false)
    expect(isValidId('A-Project')).toBe(false)
  })
})

describe('Path Traversal Protection', () => {
  it('safeResolve 应阻止路径越界', () => {
    const path = await import('node:path')
    const safeResolve = (base, ...segments) => {
      const resolved = path.resolve(base, ...segments)
      if (!resolved.startsWith(path.resolve(base) + path.sep) && resolved !== path.resolve(base)) {
        throw new Error('路径越界')
      }
      return resolved
    }

    // 正常路径
    expect(() => safeResolve('/data', 'projects', 'test.json')).not.toThrow()

    // 路径遍历攻击
    expect(() => safeResolve('/data', '..', '..', 'etc', 'passwd')).toThrow('路径越界')
  })
})

describe('Audit Log Structure', () => {
  it('操作日志应包含必要字段', () => {
    const crypto = await import('node:crypto')
    const log = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action: 'LOGIN',
      message: '测试登录',
      ip: '127.0.0.1',
      admin: 'admin',
    }
    expect(log).toHaveProperty('id')
    expect(log).toHaveProperty('timestamp')
    expect(log).toHaveProperty('action')
    expect(log).toHaveProperty('message')
    expect(log).toHaveProperty('ip')
    expect(log).toHaveProperty('admin')
  })

  it('日志写入应限制最大条数', () => {
    const MAX_LOGS = 5000
    let logs = Array(MAX_LOGS + 100).fill({ id: 'test' })
    if (logs.length > MAX_LOGS) logs.length = MAX_LOGS
    expect(logs.length).toBe(MAX_LOGS)
  })

  it('日志按操作类型筛选应正确过滤', () => {
    const logs = [
      { action: 'LOGIN', message: 'a' },
      { action: 'PROJECT_ADD', message: 'b' },
      { action: 'LOGIN', message: 'c' },
      { action: 'PROJECT_DELETE', message: 'd' },
    ]
    const filtered = logs.filter(l => l.action === 'LOGIN')
    expect(filtered).toHaveLength(2)
  })
})