# 贡献指南 (Contributing)

欢迎贡献到 EEG/EDF 可视化 Web 应用项目！

## 开发环境设置

### 前置要求

- **Node.js**: 18+
- **Python**: 3.12+
- **Docker** (可选，用于容器化部署)
- **Git**

### 后端设置

```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或
venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt

# 配置环境变量（复制 .env.example 到 .env）
cp .env.example .env

# 运行开发服务器
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 前端设置

```bash
cd frontend

# 安装依赖
npm install

# 运行开发服务器
npm run dev

# 访问 http://localhost:5173
```

### Docker 设置（一键启动）

```bash
# 在项目根目录
docker-compose up -d

# 前端: http://localhost:5173
# 后端: http://localhost:8000
```

## 开发工作流

### 1. 功能开发流程

```
┌─────────────────┐
│  创建功能分支    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  TDD: 编写测试   │  ← 先写测试！
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  实现功能代码    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  测试通过 (80%+) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  代码审查        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  提交 PR         │
└─────────────────┘
```

### 2. Git 提交规范

使用 Conventional Commits 格式：

```
<type>: <description>

[optional body]

[optional footer]
```

**类型 (type)**:
- `feat`: 新功能
- `fix`: Bug 修复
- `refactor`: 代码重构
- `test`: 测试相关
- `docs`: 文档更新
- `style`: 样式改进
- `chore`: 构建/工具链更新

**示例**:
```bash
git commit -m "feat(analysis): add linear detrend preprocessing option"
git commit -m "fix(bandpower): correct frequency boundary handling"
git commit -m "test(eeg): add band power accuracy tests"
```

### 3. 代码审查清单

提交 PR 前检查：

- [ ] 所有测试通过 (`npm run test` 和 `pytest`)
- [ ] 测试覆盖率 ≥ 80%
- [ ] 无 ESLint/TypeScript 错误
- [ ] 遵循代码风格指南
- [ ] 更新相关文档
- [ ] 添加 API 文档（如适用）
- [ ] 性能无明显退化

## 测试

### 前端测试

```bash
cd frontend

# 运行单元测试
npm run test

# 生成覆盖率报告
npm run test:coverage

# 运行 E2E 测试
npm run test:e2e

# E2E UI 模式
npm run test:e2e:ui

# E2E 调试模式
npm run test:e2e:debug
```

**覆盖率要求**:
- 语句覆盖率 ≥ 80%
- 分支覆盖率 ≥ 75%
- 函数覆盖率 ≥ 80%

### 后端测试

```bash
cd backend

# 运行所有测试
pytest

# 生成覆盖率报告
pytest --cov=app --cov-report=html

# 运行特定测试文件
pytest tests/test_analysis_api.py

# 详细输出
pytest -v

# 显示打印输出
pytest -s
```

**覆盖率要求**: ≥ 80%

### 测试文件结构

```
frontend/src/
├── api/__tests__/         # API 层测试
├── components/__tests__/  # 组件测试
├── store/__tests__/       # 状态管理测试
├── utils/__tests__/       # 工具函数测试
└── types/__tests__/       # 类型定义测试

backend/tests/
├── test_*_api.py          # API 端点测试
├── test_*_service.py      # 业务逻辑测试
└── conftest.py            # 共享 fixtures
```

## 代码风格

### TypeScript/JavaScript

- 使用 2 空格缩进
- 单引号字符串
- 无分号（ESLint 配置）
- 组件使用函数式 + Hooks
- Props 使用 TypeScript 接口

```typescript
// ✅ 好的示例
export interface Props {
  title: string;
  count: number;
}

export function MyComponent({ title, count }: Props) {
  return <div>{title}: {count}</div>;
}

// ❌ 避免
// class 组件
// any 类型
// 可选链滥用
```

### Python

- 遵循 PEP 8
- 使用 4 空格缩进
- 类型注解（Python 3.12+）
- Docstring（Google 风格）

```python
# ✅ 好的示例
def calculate_band_power(
    data: np.ndarray,
    sfreq: float,
    bands: Dict[str, Tuple[float, float]]
) -> Dict[str, float]:
    """计算频带功率.

    Args:
        data: 信号数据
        sfreq: 采样率 (Hz)
        bands: 频带定义

    Returns:
        频带功率字典
    """
    pass
```

## 项目结构

```
edf-web/
├── frontend/                    # React 前端
│   ├── src/
│   │   ├── api/                # API 客户端
│   │   ├── components/         # React 组件
│   │   ├── store/              # Zustand 状态管理
│   │   ├── types/              # TypeScript 类型
│   │   ├── utils/              # 工具函数
│   │   ├── App.tsx             # 主应用
│   │   └── main.tsx            # 入口文件
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                     # FastAPI 后端
│   ├── app/
│   │   ├── api/routes/         # API 路由
│   │   ├── models/             # Pydantic 模型
│   │   ├── services/           # 业务逻辑
│   │   ├── utils/              # 工具函数
│   │   ├── config.py           # 配置管理
│   │   └── main.py             # 应用入口
│   ├── tests/                  # 测试套件
│   ├── storage/                # 文件存储
│   ├── requirements.txt
│   └── pyproject.toml
│
├── docs/                        # 项目文档
├── docker-compose.yml
└── README.md
```

## 常用命令参考

### 前端脚本

| 命令 | 描述 |
|------|------|
| `npm run dev` | 启动开发服务器 (http://localhost:5173) |
| `npm run build` | TypeScript 编译 + Vite 构建 |
| `npm run lint` | ESLint 代码检查 |
| `npm run test` | 运行 Vitest 单元测试 |
| `npm run test:coverage` | 生成测试覆盖率报告 |
| `npm run test:e2e` | 运行 Playwright E2E 测试 |
| `npm run test:e2e:ui` | E2E 测试 UI 模式 |
| `npm run preview` | 预览生产构建 |

### 后端命令

| 命令 | 描述 |
|------|------|
| `uvicorn app.main:app --reload` | 启动开发服务器 |
| `pytest` | 运行所有测试 |
| `pytest --cov=app` | 生成覆盖率报告 |
| `pytest -v` | 详细测试输出 |
| `pytest tests/test_specific.py` | 运行单个测试文件 |
| `pip install -r requirements.txt` | 安装依赖 |

### Docker 命令

| 命令 | 描述 |
|------|------|
| `docker-compose up -d` | 启动所有服务 |
| `docker-compose logs -f` | 查看日志 |
| `docker-compose down` | 停止服务 |
| `docker-compose up --build` | 重新构建并启动 |

## 环境变量

### 后端 (.env)

| 变量 | 默认值 | 描述 |
|------|--------|------|
| `APP_HOST` | 0.0.0.0 | 服务器监听地址 |
| `APP_PORT` | 8000 | 服务器端口 |
| `APP_DEBUG` | false | 调试模式 |
| `STORAGE_PATH` | ./storage | 文件存储路径 |
| `MAX_UPLOAD_SIZE` | 104857600 | 最大上传大小 (100MB) |
| `ALLOWED_EXTENSIONS` | .edf,.edf++ | 允许的文件扩展名 |
| `CORS_ORIGINS` | http://localhost:5173 | CORS 允许的源 |
| `LOG_LEVEL` | INFO | 日志级别 |

### 前端

前端通过 `src/env.ts` 配置 API 基础 URL。

## 报告问题

1. 在 GitHub Issues 中搜索现有问题
2. 创建新问题时包含：
   - 清晰的标题
   - 重现步骤
   - 期望行为 vs 实际行为
   - 环境信息（浏览器、操作系统等）
   - 相关日志或截图

## 许可证

本项目的所有贡献都将采用项目的许可证。

---

有任何问题？请在项目中提问或联系维护者！
