# 卡密兑换系统规范

## 项目说明

卡密兑换功能使用独立的 LicenseSystem 项目作为服务端，位于：
`E:\VSCodeSpace\LicenseSystem\license-server`

## 技术栈

- **后端**: Spring Boot 3.2 + MySQL 8.4 + JWT
- **前端**: Vue 3 + Element Plus + Vite
- **认证**: JWT Token

## 项目结构

```
E:\VSCodeSpace\LicenseSystem\license-server/
├── backend/              # Spring Boot 后端
│   ├── src/main/java/com/license/
│   │   ├── controller/   # 控制器
│   │   ├── service/      # 业务逻辑
│   │   ├── entity/       # 实体类
│   │   └── dto/          # 数据传输对象
│   └── pom.xml
├── frontend/             # Vue 3 管理前端
│   ├── src/
│   │   ├── api/          # API 请求
│   │   ├── components/
│   │   └── views/
│   └── package.json
└── README.md
```

## 核心功能

### 1. 卡密管理
- 批量生成卡密
- 设置有效期和类型
- 绑定账号数据（payload）
- 状态管理（启用/禁用）

### 2. 兑换验证
- 卡密有效性验证
- 返回绑定的账号数据
- 防重复使用
- 记录验证日志

### 3. 管理界面
- 用户权限管理
- 卡密生成和查询
- 统计数据展示
- 系统设置

## API 接口

### 公开接口
- `POST /api/cards/verify` - 卡密验证（现有）
- `POST /api/cards/redeem` - 卡密兑换（需新增）

### 管理接口
- `POST /api/cards/generate` - 生成卡密
- `GET /api/cards` - 卡密列表
- `PUT /api/cards/status` - 更新状态

## 数据库表结构

### cards 表
- `id` - 主键
- `card_key` - 卡密
- `card_type` - 类型
- `status` - 状态
- `expire_at` - 过期时间
- `payload` - 账号数据（JSON）
- `created_at` - 创建时间
- `used_at` - 使用时间

## 开发规范

### 后端开发
- 使用 Spring Boot 3.2
- 遵循 RESTful API 设计
- 统一异常处理
- 请求参数验证

### 前端开发
- 使用 Vue 3 Composition API
- Element Plus 组件库
- 统一的 API 请求封装
- 响应式设计

### 数据格式
账号数据 payload 格式：
```json
{
  "email": "user@example.com",
  "provider": "social",
  "token": "jwt_token_here",
  "refreshToken": "refresh_token_here",
  "expiresAt": "2026-01-08T10:30:00Z",
  "subscription": "PRO",
  "usage": {
    "main": { "used": 0, "limit": 1000000 },
    "trial": { "used": 0, "limit": 50000 },
    "reward": { "used": 0, "limit": 0 }
  },
  "remark": "通过卡密兑换获得"
}
```

## 部署规范

### 开发环境
```bash
# 后端
cd E:\VSCodeSpace\LicenseSystem\license-server\backend
mvn spring-boot:run

# 前端
cd E:\VSCodeSpace\LicenseSystem\license-server\frontend
npm run dev
```

### 生产环境
- 使用 Docker 容器化部署
- MySQL 数据库独立部署
- 配置 HTTPS 和域名
- 设置环境变量

## 安全规范

### 数据安全
- 卡密使用强随机生成
- 敏感数据加密存储
- API 接口限流
- 日志脱敏处理

### 访问控制
- JWT Token 认证
- 角色权限管理
- IP 白名单（可选）
- API 密钥验证

## 测试规范

### 单元测试
- Service 层业务逻辑测试
- Controller 层接口测试
- 数据库操作测试

### 集成测试
- 完整的兑换流程测试
- 错误场景测试
- 性能压力测试

## 监控规范

### 日志记录
- 所有 API 请求日志
- 业务操作日志
- 错误异常日志
- 性能监控日志

### 告警机制
- 数据库连接异常
- API 响应时间过长
- 异常请求频率过高

## 维护规范

### 数据备份
- 定期备份数据库
- 配置文件版本控制
- 日志文件轮转

### 版本管理
- 遵循语义化版本号
- 记录变更日志
- 数据库迁移脚本

## 注意事项

1. **独立项目**: LicenseSystem 是独立项目，不纳入 kiro-account-manager 版本控制
2. **外部访问**: 需要通过 PowerShell 访问 `E:\VSCodeSpace\LicenseSystem\license-server` 目录
3. **接口兼容**: 确保 API 接口与客户端 `redeem_cmd.rs` 兼容
4. **数据一致**: payload 格式必须与 Account 结构体匹配
5. **安全第一**: 卡密只能使用一次，防止重复兑换

## 开发流程

1. 在 LicenseSystem 项目中开发新功能
2. 本地测试验证
3. 部署到测试服务器
4. 客户端集成测试
5. 生产环境部署

## 故障处理

### 常见问题
- 数据库连接失败
- JWT Token 过期
- 卡密格式错误
- 网络超时

### 处理步骤
1. 查看日志定位问题
2. 检查配置和环境
3. 重启相关服务
4. 联系运维支持