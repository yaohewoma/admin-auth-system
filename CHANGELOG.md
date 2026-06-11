# Changelog

All notable changes to this skill will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.1.0] - 2026-06-11

### Added
- `references/account-manager.js` — 完整账户 CRUD + 密码策略 + 统计功能（268 行）
- `references/login-handler.js` — 单密码/多账户双模式登录处理器 + Axios 拦截器参考（132 行）
- `types/index.d.ts` — TypeScript 类型定义文件，含 30+ interfaces/types（214 行）
- `package.json` — NPM 依赖清单、脚本、keywords、engines 配置
- `.gitignore` — 标准 Node.js 忽略规则
- `LICENSE` — MIT 开源许可证

### Changed
- **SKILL.md**
  - Section 0 新增实战验证数据表格（7 项核心指标）
  - Section 2.1 模块地图新增 4 行（login-handler、account-manager、TypeScript 类型、可选扩展表）
  - Section 2.5 后新增 2.6（前端集成指南）、2.7（部署方案）、2.8（可选扩展）三个子模块
  - Section 4 常见错误从 7 条扩展到 11 条
  - Section 5 新增"场景预设配置"表（4 种场景 × 6 参数组合）
  - Section 7 文件结构树更新为完整 22 个文件

- **tests/test-auth.test.js** — 从 3 个用例扩展到 8 个测试套件 × 25+ 用例
  - 新增：bcrypt 哈希/验证/边界条件（6 用例）
  - 新增：JWT 签发/验证/过期/错误密钥（5 用例）
  - 新增：限流配置合理性校验（3 用例）
  - 新增：输入校验 & isValidId 格式验证（2 用例）
  - 新增：路径遍历防护攻击测试（2 用例）
  - 新增：审计日志结构/截断/筛选（3 用例）

### Removed
- `examples/basic-server.js` — 与 `basic-auth-server.js` 重复，已删除

### Fixed
- SKILL.md frontmatter `name` 字段加双引号（与其他 skill 规范统一）
- SKILL.md frontmatter `description` 改为英文（与 5/7 个 skill 一致）
- Section 3 标题统一为"标准流程"（对齐 CONTRIBUTING.md 模板）
- Section 6 Quick Start 拆分为双方式 + 消除重复的配置示例
- Section 编号连续：新增 Section 7 后无断裂

## [1.0.0] - 2026-06-11

### Added
- Initial release
- Complete SKILL.md with standardized structure (sections 0-6)
- Full references/ documentation (6 .md files)
- Troubleshooting guide with 14 common issues
- Examples and test fixtures