# 脚本参考手册

本文档提供项目中所有可用脚本的快速参考。

---

## 前端脚本 (frontend/package.json)

### 开发命令

| 命令 | 描述 | 示例 |
|------|------|------|
| `npm run dev` | 启动 Vite 开发服务器 | `http://localhost:5173` |
| `npm run build` | TypeScript 编译 + Vite 构建 | 生成 `dist/` 目录 |
| `npm run preview` | 预览生产构建 | `http://localhost:4173` |
| `npm run lint` | ESLint 代码检查 | 检查 `src/` 目录 |

### 测试命令

| 命令 | 描述 | 输出 |
|------|------|------|
| `npm run test` | 运行 Vitest 单元测试 | 终端输出 |
| `npm run test:coverage` | 生成测试覆盖率报告 | `coverage/` 目录 |
| `npm run test:e2e` | 运行 Playwright E2E 测试 | 终端输出 |
| `npm run test:e2e:ui` | E2E 测试 UI 模式 | 打开 UI 界面 |
| `npm run test:e2e:debug` | E2E 测试调试模式 | 打开浏览器 |
| `npm run test:e2e:headed` | E2E 测试有头模式 | 显示浏览器 |
| `npm run test:e2e:report` | 查看 E2E 测试报告 | 打开 HTML 报告 |

---

## 后端命令

### 开发命令

| 命令 | 描述 | 示例 |
|------|------|------|
| `uvicorn app.main:app --reload` | 启动开发服务器 | `http://localhost:8000` |
| `uvicorn app.main:app --host 0.0.0.0 --port 8000` | 指定端口 | 自定义配置 |
| `python -m pip install -r requirements.txt` | 安装依赖 | 虚拟环境 |

### 测试命令

| 命令 | 描述 | 输出 |
|------|------|------|
| `pytest` | 运行所有测试 | 终端输出 |
| `pytest -v` | 详细测试输出 | 显示每个测试 |
| `pytest --cov=app` | 生成覆盖率报告 | 终端 + HTML |
| `pytest --cov-report=html` | HTML 覆盖率报告 | `htmlcov/` 目录 |
| `pytest tests/test_specific.py` | 运行单个测试文件 | 指定文件 |
| `pytest -k "test_band_power"` | 运行匹配测试 | 关键词过滤 |
| `pytest -s` | 显示打印输出 | 调试用 |

---

## Docker 命令

| 命令 | 描述 |
|------|------|
| `docker-compose up -d` | 后台启动所有服务 |
| `docker-compose up --build` | 重新构建并启动 |
| `docker-compose down` | 停止并删除容器 |
| `docker-compose logs -f` | 查看实时日志 |
| `docker-compose ps` | 查看服务状态 |
| `docker-compose restart backend` | 重启单个服务 |
| `docker-compose exec backend bash` | 进入容器 Shell |
| `docker-compose build --no-cache` | 无缓存构建 |

---

## Git 工作流命令

### 分支管理

| 命令 | 描述 |
|------|------|
| `git checkout -b feat/new-feature` | 创建功能分支 |
| `git checkout main` | 切换到主分支 |
| `git merge feat/new-feature` | 合并分支 |
| `git branch -d feat/new-feature` | 删除本地分支 |

### 提交规范

| 命令 | 描述 |
|------|------|
| `git add .` | 暂存所有更改 |
| `git commit -m "feat: add new feature"` | 提交更改 |
| `git commit --amend` | 修改最后一次提交 |
| `git rebase -i HEAD~3` | 交互式变基 |
| `git cherry-pick <commit-hash>` | 挑选提交 |

### 远程操作

| 命令 | 描述 |
|------|------|
| `git push origin feat/new-feature` | 推送分支 |
| `git pull origin main` | 拉取更新 |
| `git fetch --all` | 获取所有远程更新 |
| `git remote -v` | 查看远程仓库 |

---

## Python 工具命令

### 依赖管理

| 命令 | 描述 |
|------|------|
| `pip list` | 列出已安装包 |
| `pip freeze > requirements.txt` | 导出依赖 |
| `pip install -r requirements.txt` | 安装依赖 |
| `pip-audit` | 检查安全漏洞 |

### 虚拟环境

| 命令 | 描述 |
|------|------|
| `python -m venv venv` | 创建虚拟环境 |
| `source venv/bin/activate` | 激活 (Linux/Mac) |
| `venv\Scripts\activate` | 激活 (Windows) |
| `deactivate` | 停用虚拟环境 |

---

## Node.js 工具命令

### 包管理

| 命令 | 描述 |
|------|------|
| `npm install` | 安装依赖 |
| `npm install <package>` | 安装单个包 |
| `npm install -D <package>` | 安装开发依赖 |
| `npm update` | 更新依赖 |
| `npm outdated` | 检查过时包 |
| `npm audit` | 检查安全漏洞 |

### TypeScript

| 命令 | 描述 |
|------|------|
| `npx tsc` | 编译 TypeScript |
| `npx tsc --noEmit` | 仅检查类型 |
| `npx tsc --watch` | 监视模式 |

---

## 快速故障排除

### 清理缓存

```bash
# 前端
rm -rf node_modules
npm cache clean --force
npm install

# 后端
pip cache purge
pip install --force-reinstall -r requirements.txt

# Docker
docker system prune -a
```

### 重置开发环境

```bash
# 停止所有服务
docker-compose down

# 清理容器和卷
docker-compose down -v

# 重新构建
docker-compose up --build
```

### 查看日志

```bash
# Docker 日志
docker-compose logs -f backend
docker-compose logs -f frontend

# 后端日志文件
tail -f backend/logs/app.log

# Nginx 日志
tail -f /var/log/nginx/error.log
```

---

**更新时间**: 2026-02-03
