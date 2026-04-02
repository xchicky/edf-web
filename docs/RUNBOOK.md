# 运维手册 (Runbook)

本文档提供 EEG/EDF 可视化 Web 应用的部署、监控和故障排除指南。

## 目录

- [部署流程](#部署流程)
- [监控与告警](#监控与告警)
- [常见问题处理](#常见问题处理)
- [回滚流程](#回滚流程)
- [性能优化](#性能优化)
- [安全检查清单](#安全检查清单)

---

## 部署流程

### Docker 部署（推荐）

#### 1. 准备环境

```bash
# 克隆仓库
git clone <repository-url>
cd edf-web

# 检查 Docker 版本
docker --version  # >= 20.10
docker-compose --version  # >= 2.0
```

#### 2. 配置环境变量

```bash
# 复制后端环境变量模板
cp backend/.env.example backend/.env

# 编辑配置（根据生产环境调整）
nano backend/.env
```

**生产环境配置建议**:
```bash
APP_HOST=0.0.0.0
APP_PORT=8000
APP_DEBUG=false
STORAGE_PATH=/app/storage
MAX_UPLOAD_SIZE=104857600
ALLOWED_EXTENSIONS=.edf,.edf++
CORS_ORIGINS=https://your-domain.com
LOG_LEVEL=WARNING
```

#### 3. 构建和启动

```bash
# 构建镜像
docker-compose build

# 启动服务（后台运行）
docker-compose up -d

# 验证服务状态
docker-compose ps
```

#### 4. 健康检查

```bash
# 后端健康检查
curl http://localhost:8000/health

# 前端访问
curl http://localhost:5173
```

#### 5. 配置反向代理（Nginx）

```nginx
# /etc/nginx/sites-available/edf-web
server {
    listen 80;
    server_name your-domain.com;

    # 前端
    location / {
        proxy_pass http://localhost:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 100M;
    }

    # 文件上传
    location /upload/ {
        proxy_pass http://localhost:8000/upload/;
        client_max_body_size 100M;
    }
}
```

### 手动部署

#### 后端部署

```bash
cd backend

# 安装依赖
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env

# 使用 Gunicorn 运行（生产环境）
pip install gunicorn
gunicorn app.main:app \
    --workers 4 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:8000 \
    --access-logfile - \
    --error-logfile -
```

#### 前端部署

```bash
cd frontend

# 安装依赖
npm install

# 构建生产版本
npm run build

# 使用 Nginx 提供静态文件服务
# 或部署到 Vercel/Netlify
```

---

## 监控与告警

### 健康检查端点

```bash
# 后端健康检查
GET /health

响应:
{
  "status": "healthy",
  "timestamp": "2026-02-03T12:00:00Z",
  "version": "1.0.0"
}
```

### 监控指标

| 指标 | 类型 | 告警阈值 |
|------|------|----------|
| CPU 使用率 | 系统 | > 80% (5 分钟) |
| 内存使用率 | 系统 | > 85% |
| 磁盘空间 | 系统 | > 90% |
| API 响应时间 | 应用 | > 2s (P95) |
| 错误率 | 应用 | > 5% |
| 上传失败率 | 业务 | > 1% |

### 日志

**后端日志位置**:
- 容器: `docker-compose logs backend`
- 文件: `/var/log/edf-web/backend.log` (手动部署)

**日志级别**:
- `DEBUG`: 开发调试
- `INFO`: 正常运行
- `WARNING`: 警告信息
- `ERROR`: 错误信息
- `CRITICAL`: 严重错误

### 监控工具推荐

1. **Prometheus + Grafana**: 指标收集和可视化
2. **ELK Stack**: 日志聚合和分析
3. **Sentry**: 错误追踪
4. **Uptime Robot**: 服务可用性监控

---

## 常见问题处理

### 1. 服务无法启动

**症状**: `docker-compose up` 失败

**诊断**:
```bash
# 查看日志
docker-compose logs backend
docker-compose logs frontend

# 检查端口占用
lsof -i :8000
lsof -i :5173
```

**解决方案**:
```bash
# 停止并删除旧容器
docker-compose down

# 清理悬挂镜像
docker image prune

# 重新构建
docker-compose up --build
```

### 2. 文件上传失败

**症状**: 上传 EDF 文件时返回 413 错误

**原因**: Nginx `client_max_body_size` 限制

**解决方案**:
```nginx
# 在 nginx 配置中增加
client_max_body_size 100M;
```

### 3. API 响应慢

**症状**: API 请求超过 5 秒

**诊断**:
```bash
# 检查后端日志
docker-compose logs backend | grep "WARNING"

# 检查系统资源
htop
```

**可能原因和解决方案**:
1. **大文件处理**: 增加 `MAX_UPLOAD_SIZE` 或优化 EDF 解析
2. **内存不足**: 增加 Docker 内存限制或使用流式处理
3. **数据库慢查询**: 添加索引或优化查询

### 4. 前端构建失败

**症状**: `npm run build` 报错

**诊断**:
```bash
# 清理缓存
rm -rf node_modules
npm cache clean --force

# 重新安装
npm install
```

**常见错误**:
- `TypeScript error`: 检查类型定义
- `Module not found`: 检查导入路径
- `Memory heap out of memory`: 增加 Node.js 内存限制

```bash
NODE_OPTIONS=--max-old-space-size=4096 npm run build
```

### 5. 频带功率计算不准确

**症状**: 10Hz Alpha 波被识别为其他频带

**可能原因**:
- 信号包含漂移
- 选区太短导致频率分辨率不足

**解决方案**:
- 使用预处理功能（线性去漂移）
- 增加选区长度（≥1 秒）
- 参考 `exp/reports/FINAL_REPORT.md`

### 6. 容器内存溢出

**症状**: 容器反复重启

**诊断**:
```bash
docker stats
```

**解决方案**:
```yaml
# docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 512M
```

---

## 回滚流程

### Docker 回滚

```bash
# 1. 停止当前服务
docker-compose down

# 2. 切换到上一个稳定版本
git checkout <previous-stable-tag>

# 3. 重新构建
docker-compose build

# 4. 启动服务
docker-compose up -d

# 5. 验证
curl http://localhost:8000/health
```

### 数据库回滚（如有）

```bash
# 备份当前数据
docker exec postgres pg_dump -U user edfweb > backup.sql

# 恢复到之前版本
docker exec -i postgres psql -U user edfweb < previous_backup.sql
```

---

## 性能优化

### 后端优化

1. **启用 Gzip 压缩**
```python
from fastapi.middleware.gzip import GZipMiddleware

app.add_middleware(GZipMiddleware, minimum_size=1000)
```

2. **使用连接池**
```python
from sqlalchemy.pool import QueuePool

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=10,
    max_overflow=20
)
```

3. **缓存计算结果**
- 使用 Redis 缓存频带功率计算结果
- TTL 设置为 1 小时

### 前端优化

1. **代码分割**
```typescript
// 动态导入大型组件
const FrequencyView = lazy(() => import('./components/FrequencyView'));
```

2. **图片优化**
- 使用 WebP 格式
- 懒加载图片

3. **减少重渲染**
- 使用 `React.memo`
- 使用 `useMemo` 和 `useCallback`

### 网络优化

1. **启用 CDN**
- 静态资源使用 CDN
- 减少延迟

2. **HTTP/2**
- Nginx 启用 HTTP/2

---

## 安全检查清单

### 定期检查

- [ ] 更新依赖包（`npm audit` 和 `pip-audit`）
- [ ] 检查漏洞（`docker scan`）
- [ ] 审查访问日志
- [ ] 验证备份完整性

### 安全配置

1. **HTTPS**
```nginx
server {
    listen 443 ssl http2;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
}
```

2. **CORS**
```python
# 仅允许可信域名
CORS_ORIGINS=https://your-domain.com
```

3. **文件上传限制**
- 验证文件类型
- 限制文件大小
- 扫描恶意文件

4. **敏感信息**
- 不要在日志中记录敏感数据
- 使用环境变量存储密钥
- 定期轮换密钥

---

## 备份策略

### 自动备份脚本

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/edf-web"

# 备份上传的文件
tar -czf $BACKUP_DIR/storage_$DATE.tar.gz backend/storage/

# 备份配置
cp backend/.env $BACKUP_DIR/.env_$DATE

# 保留最近 7 天的备份
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

### 恢复流程

```bash
# 解压文件备份
tar -xzf storage_20260203_120000.tar.gz -C backend/

# 恢复配置
cp .env_20260203_120000 backend/.env

# 重启服务
docker-compose restart
```

---

## 联系方式

- **维护团队**: dev@example.com
- **紧急联系**: +86-xxx-xxxx-xxxx
- **文档更新**: 2026-02-03

---

**版本**: 1.0.0
**最后更新**: 2026-02-03
