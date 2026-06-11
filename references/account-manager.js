/**
 * 多账户管理模块 — 账户 CRUD、密码策略、角色管理
 *
 * @module account-manager
 */

import bcrypt from 'bcryptjs'
import fs    from 'node:fs'
import path  from 'node:path'

// ── 配置 ──────────────────────────────────────────────────────────────────

const DATA_DIR      = process.env.DATA_DIR || path.join(process.cwd(), 'data')
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json')
const SALT_ROUNDS   = parseInt(process.env.SALT_ROUNDS, 10) || 12
const MIN_PASSWORD_LENGTH = parseInt(process.env.MIN_PASSWORD_LENGTH, 10) || 8

// ── 内部工具 ──────────────────────────────────────────────────────────────

/** 确保数据目录存在 */
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

/** 原子写入 JSON（先写 .tmp 再 rename） */
function writeJsonSafe(filePath, data) {
  const tmpPath = filePath + '.tmp'
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tmpPath, filePath)
}

/** 读取全部账户 */
function readAccounts() {
  ensureDataDir()
  try { return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf-8')) }
  catch { return [] }
}

/** 写入全部账户 */
function writeAccounts(accounts) {
  ensureDataDir()
  writeJsonSafe(ACCOUNTS_FILE, accounts)
}

// ── 密码工具 ──────────────────────────────────────────────────────────────

/**
 * 生成密码哈希
 * @param {string} password - 明文密码
 * @returns {string} bcrypt 哈希字符串
 * @throws {Error} 密码不符合策略时抛出
 */
function hashPassword(password) {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`密码至少需要 ${MIN_PASSWORD_LENGTH} 个字符`)
  }
  return bcrypt.hashSync(password, SALT_ROUNDS)
}

/**
 * 验证密码
 * @param {string} password - 明文密码
 * @param {string} hash - 存储的 bcrypt 哈希
 * @returns {boolean} 是否匹配
 */
function verifyPassword(password, hash) {
  if (!password || !hash) return false
  return bcrypt.compareSync(password, hash)
}

// ── 账户 CRUD ─────────────────────────────────────────────────────────────

/**
 * 获取所有账户（脱敏，不返回 passwordHash）
 * @returns {Array<Omit<Account, 'passwordHash'>>}
 */
function getAccounts() {
  const accounts = readAccounts()
  return accounts.map(({ passwordHash, ...rest }) => rest)
}

/**
 * 根据 ID 查找账户（含完整数据）
 * @param {string} id - 账户 ID
 * @returns {Account|null}
 */
function findAccount(id) {
  const accounts = readAccounts()
  return accounts.find(a => a.id === id) || null
}

/**
 * 创建新账户
 * @param {Object} params
 * @param {string} params.id       - 账户 ID（用户名）
 * @param {string} params.name     - 显示名称
 * @param {string} params.password - 明文密码
 * @param {string} [params.role='viewer'] - 角色
 * @returns {Omit<Account, 'passwordHash'>} 创建的账户（脱敏）
 * @throws {Error} 账户已存在或密码不符合策略时抛出
 */
function createAccount({ id, name, password, role = 'viewer' }) {
  if (!id || !name || !password) {
    throw new Error('缺少必填字段：id, name, password')
  }

  const accounts = readAccounts()

  if (accounts.find(a => a.id === id)) {
    throw new Error(`账户「${id}」已存在`)
  }

  const newAccount = {
    id,
    name,
    role,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  }

  accounts.push(newAccount)
  writeAccounts(accounts)

  const { passwordHash, ...safe } = newAccount
  return safe
}

/**
 * 更新账户信息（名称、角色）
 * @param {string} id       - 账户 ID
 * @param {Object} updates   - 要更新的字段（name, role）
 * @returns {Omit<Account, 'passwordHash'>|null} 更新后的账户，不存在返回 null
 */
function updateAccount(id, updates) {
  const accounts = readAccounts()
  const idx = accounts.findIndex(a => a.id === id)
  if (idx === -1) return null

  if (updates.name) accounts[idx].name = updates.name
  if (updates.role) accounts[idx].role = updates.role

  writeAccounts(accounts)
  const { passwordHash, ...safe } = accounts[idx]
  return safe
}

/**
 * 修改账户密码
 * @param {string} id           - 账户 ID
 * @param {string} oldPassword  - 旧密码
 * @param {string} newPassword  - 新密码
 * @returns {{ success: boolean, error?: string }}
 */
function changePassword(id, oldPassword, newPassword) {
  const accounts = readAccounts()
  const idx = accounts.findIndex(a => a.id === id)

  if (idx === -1) return { success: false, error: '账户不存在' }
  if (!verifyPassword(oldPassword, accounts[idx].passwordHash)) {
    return { success: false, error: '旧密码错误' }
  }
  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    return { success: false, error: `新密码至少需要 ${MIN_PASSWORD_LENGTH} 个字符` }
  }

  accounts[idx].passwordHash = hashPassword(newPassword)
  writeAccounts(accounts)
  return { success: true }
}

/**
 * 管理员重置账户密码
 * @param {string} id          - 目标账户 ID
 * @param {string} newPassword - 新密码（明文）
 * @returns {{ success: boolean, error?: string }}
 */
function resetPassword(id, newPassword) {
  const accounts = readAccounts()
  const idx = accounts.findIndex(a => a.id === id)

  if (idx === -1) return { success: false, error: '账户不存在' }
  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    return { success: false, error: `新密码至少需要 ${MIN_PASSWORD_LENGTH} 个字符` }
  }

  accounts[idx].passwordHash = hashPassword(newPassword)
  writeAccounts(accounts)
  return { success: true }
}

/**
 * 删除账户
 * @param {string} id - 账户 ID
 * @returns {boolean} 是否成功删除
 */
function deleteAccount(id) {
  const accounts = readAccounts()
  const filtered = accounts.filter(a => a.id !== id)
  if (filtered.length === accounts.length) return false
  writeAccounts(filtered)
  return true
}

/**
 * 记录账户最后登录时间
 * @param {string} id - 账户 ID
 */
function recordLogin(id) {
  const accounts = readAccounts()
  const account = accounts.find(a => a.id === id)
  if (account) {
    account.lastLogin = new Date().toISOString()
    writeAccounts(accounts)
  }
}

// ── 账户统计 ──────────────────────────────────────────────────────────────

/**
 * 获取账户统计信息
 * @returns {{ total: number, byRole: Object, recentLogins: number }}
 */
function getAccountStats() {
  const accounts = readAccounts()
  const byRole = {}
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  let recentLogins = 0

  accounts.forEach(a => {
    byRole[a.role] = (byRole[a.role] || 0) + 1
    if (a.lastLogin && new Date(a.lastLogin).getTime() > oneWeekAgo) {
      recentLogins++
    }
  })

  return {
    total: accounts.length,
    byRole,
    recentLogins,
  }
}

// ── 账户数据契约（TypeScript 类型参考）─────────────────────────────────────
//
// interface Account {
//   id: string           // 账户唯一标识（用户名）
//   name: string         // 显示名称
//   role: string         // 角色（admin | operator | viewer）
//   passwordHash: string // bcrypt 哈希
//   createdAt: string    // 创建时间（ISO 8601）
//   lastLogin?: string   // 最后登录时间（ISO 8601）
// }

export {
  hashPassword,
  verifyPassword,
  getAccounts,
  findAccount,
  createAccount,
  updateAccount,
  changePassword,
  resetPassword,
  deleteAccount,
  recordLogin,
  getAccountStats,
}