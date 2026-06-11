/**
 * 操作日志模块 — 日志记录、查询、统计、审计追踪
 *
 * @module audit-logger
 */

import fs   from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

// ── 配置 ──────────────────────────────────────────────────────────────────

const LOGS_DIR  = path.join(process.cwd(), 'logs')
const LOG_FILE  = path.join(LOGS_DIR, 'operations.json')
const MAX_LOGS  = parseInt(process.env.MAX_LOGS, 10) || 5000

// ── 内部函数 ──────────────────────────────────────────────────────────────

/** 确保日志目录存在 */
function ensureLogDir() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true })
  }
}

/** 读取全部日志 */
function readLogs() {
  ensureLogDir()
  try {
    const raw = fs.readFileSync(LOG_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

/** 原子写入 JSON（先写临时文件再 rename，防止并发写坏） */
function writeJsonSafe(filePath, data) {
  const tmpPath = filePath + '.tmp'
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tmpPath, filePath)
}

// ── 公共 API ──────────────────────────────────────────────────────────────

/**
 * 从 Express 请求中提取操作者信息
 * @param {import('express').Request} req
 * @returns {{ ip: string, admin: string }}
 */
function getOperatorInfo(req) {
  return {
    ip: req.ip || req.socket?.remoteAddress || 'unknown',
    admin: req.adminInfo?.role || 'unknown',
  }
}

/**
 * 写入一条操作日志
 *
 * @param {Object} operation - 操作信息
 * @param {string} operation.action  - 操作类型（LOGIN / PROJECT_ADD / PROJECT_DELETE 等）
 * @param {string} operation.message - 操作描述
 * @param {string} [operation.ip]    - 操作者 IP
 * @param {string} [operation.admin] - 操作者角色
 * @param {*}      [operation.*]     - 业务相关字段（如 projectId, count 等）
 *
 * @example
 *   writeLog({ action: 'PROJECT_DELETE', message: '删除项目「AI助手」', ...getOperatorInfo(req) })
 */
function writeLog(operation) {
  ensureLogDir()
  const logs = readLogs()

  logs.unshift({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...operation,
  })

  // 自动截断到 MAX_LOGS
  if (logs.length > MAX_LOGS) {
    logs.length = MAX_LOGS
  }

  writeJsonSafe(LOG_FILE, logs)
}

/**
 * 分页查询日志
 *
 * @param {Object} options
 * @param {number} [options.page=1]    - 页码
 * @param {number} [options.limit=50]  - 每页条数
 * @param {string} [options.action]    - 按操作类型筛选
 * @returns {{ logs: Object[], total: number, page: number, limit: number, totalPages: number }}
 */
function queryLogs({ page = 1, limit = 50, action } = {}) {
  let logs = readLogs()

  if (action) {
    logs = logs.filter(l => l.action === action)
  }

  const pageNum  = parseInt(page, 10)
  const limitNum = parseInt(limit, 10)
  const start    = (pageNum - 1) * limitNum
  const paged    = logs.slice(start, start + limitNum)

  return {
    logs: paged,
    total: logs.length,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(logs.length / limitNum),
  }
}

/**
 * 获取日志统计摘要
 * @returns {{ total: number, today: number, byAction: Object, latest: Object[] }}
 */
function getLogSummary() {
  const logs  = readLogs()
  const today = new Date().toISOString().slice(0, 10)
  const actionCounts = {}
  let todayCount = 0

  logs.forEach(l => {
    actionCounts[l.action] = (actionCounts[l.action] || 0) + 1
    if (l.timestamp?.startsWith(today)) todayCount++
  })

  return {
    total: logs.length,
    today: todayCount,
    byAction: actionCounts,
    latest: logs.slice(0, 5),
  }
}

/**
 * 清空所有日志（仅 admin 可用）
 */
function clearLogs() {
  writeJsonSafe(LOG_FILE, [])
}

// ── 操作类型速查 ──────────────────────────────────────────────────────────
//
// | 操作类型               | 触发场景         |
// |-----------------------|-----------------|
// | LOGIN                 | 登录成功          |
// | LOGIN_FAILED          | 密码错误          |
// | PASSWORD_CHANGE       | 管理员改密         |
// | CONFIG_UPDATE         | 修改系统配置       |
// | PROJECT_ADD           | 新增项目          |
// | PROJECT_UPDATE        | 编辑项目          |
// | PROJECT_DELETE        | 删除项目          |
// | PROJECTS_BATCH_DELETE | 批量删除          |
// | BACKUP_CREATE         | 手动备份          |
// | BACKUP_RESTORE        | 数据恢复          |
// | LOGS_CLEAR            | 清理日志          |

export { writeLog, queryLogs, getLogSummary, clearLogs, getOperatorInfo }