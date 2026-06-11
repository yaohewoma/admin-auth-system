/**
 * admin-auth-system TypeScript 类型定义
 *
 * @module admin-auth-system/types
 */

// ── 账户 ──────────────────────────────────────────────────────────────────

/** 账户实体（完整，含密码哈希） */
export interface Account {
  id: string
  name: string
  role: 'admin' | 'operator' | 'viewer'
  passwordHash: string
  createdAt: string
  lastLogin?: string
}

/** 账户实体（脱敏，不含密码） */
export type SafeAccount = Omit<Account, 'passwordHash'>

/** 创建账户参数 */
export interface CreateAccountParams {
  id: string
  name: string
  password: string
  role?: 'admin' | 'operator' | 'viewer'
}

// ── JWT ───────────────────────────────────────────────────────────────────

/** JWT Token 负载 */
export interface TokenPayload {
  userId: string
  userName: string
  role: 'admin' | 'operator' | 'viewer'
  iat: number   // 签发时间戳（Unix 秒）
  exp: number   // 过期时间戳（Unix 秒）
}

/** 登录请求体 */
export interface LoginRequest {
  username?: string
  password: string
}

/** 登录成功响应 */
export interface LoginResponse {
  token: string
  user: SafeAccount
  message: string
}

// ── RBAC ──────────────────────────────────────────────────────────────────

/** 角色类型 */
export type Role = 'admin' | 'operator' | 'viewer'

/** 权限名称 */
export type Permission = 'read' | 'write' | 'export' | 'log:read'

/** 角色权限映射 */
export type RolePermissions = Record<Role, Array<Permission | '*'>>

// ── 操作日志 ──────────────────────────────────────────────────────────────

/** 操作类型 */
export type AuditAction =
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'PASSWORD_CHANGE'
  | 'CONFIG_UPDATE'
  | 'PROJECT_ADD'
  | 'PROJECT_UPDATE'
  | 'PROJECT_DELETE'
  | 'PROJECTS_BATCH_DELETE'
  | 'BACKUP_CREATE'
  | 'BACKUP_RESTORE'
  | 'LOGS_CLEAR'

/** 操作日志条目 */
export interface OperationLog {
  id: string
  timestamp: string
  action: AuditAction
  message: string
  ip: string
  admin: string
  // 业务相关可选字段
  projectId?: string
  competitionId?: string
  track?: string
  tier?: string
  name?: string
  count?: number
  topicId?: number
}

/** 操作者信息 */
export interface OperatorInfo {
  ip: string
  admin: string
}

/** 日志分页查询参数 */
export interface LogQueryParams {
  page?: number
  limit?: number
  action?: AuditAction
}

/** 日志分页查询结果 */
export interface LogQueryResult {
  logs: OperationLog[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/** 日志统计摘要 */
export interface LogSummary {
  total: number
  today: number
  byAction: Record<string, number>
  latest: OperationLog[]
}

// ── 安全配置 ──────────────────────────────────────────────────────────────

/** 频率限制配置 */
export interface RateLimitConfig {
  windowMs: number
  max: number
  message: { error: string }
  standardHeaders: boolean
  legacyHeaders: boolean
  keyGenerator?: (req: ExpressRequest) => string
}

/** CORS 配置 */
export interface CorsConfig {
  origin: string[]
  credentials: boolean
  methods: string[]
  allowedHeaders: string[]
  maxAge: number
}

// ── API 通用型 ────────────────────────────────────────────────────────────

/** 通用成功响应 */
export interface SuccessResponse<T = unknown> {
  message: string
  data?: T
  [key: string]: unknown
}

/** 通用错误响应 */
export interface ErrorResponse {
  error: string
  required?: string[]
  current?: string
}

/** HTTP 状态码枚举 */
export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_ERROR = 500,
}

// ── Express 扩展类型 ──────────────────────────────────────────────────────

/** 最小化 Express Request 类型（用于 JSDoc） */
interface ExpressRequest {
  ip?: string
  socket?: { remoteAddress?: string }
  headers: Record<string, string | undefined>
  body: Record<string, unknown>
  params: Record<string, string>
  query: Record<string, string>
  adminInfo?: TokenPayload
}

/** 最小化 Express Response 类型（用于 JSDoc） */
interface ExpressResponse {
  status(code: number): ExpressResponse
  json(data: unknown): void
  setHeader(name: string, value: string): void
}

/** Express Next 函数类型 */
type ExpressNext = (err?: Error) => void

// ── 环境变量 ──────────────────────────────────────────────────────────────

/** 环境变量配置 */
export interface EnvConfig {
  ADMIN_PASSWORD: string
  JWT_SECRET: string
  ADMIN_PORT?: number
  ALLOWED_ORIGINS?: string
  TOKEN_EXPIRES?: string
  MAX_LOGS?: number
  MIN_PASSWORD_LENGTH?: number
  SALT_ROUNDS?: number
  DATA_DIR?: string
}