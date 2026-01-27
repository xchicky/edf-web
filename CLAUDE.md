# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个用于读取和可视化 EEG/脑电图数据的 Web 应用程序，支持 EDF/EDF+ 文件格式。项目采用前后端分离架构，专注于医疗数据可视化领域。

**核心技术栈**:
- 前端: React 19.2.0 + TypeScript 5.9.3 + Vite 7.2.4
- 后端: FastAPI 0.104.1 + MNE-Python 1.11.0
- 状态管理: Zustand 5.0.10
- 可视化: Canvas API + uPlot 1.6.32
- 容器化: Docker + Docker Compose

## 开发命令

### 前端 (frontend/)
```bash
npm run dev              # 启动开发服务器 (http://localhost:5173)
npm run build            # TypeScript 编译 + Vite 构建
npm run test             # 运行 Vitest 单元测试
npm run test:coverage    # 生成测试覆盖率报告 (要求 80%)
npm run lint             # ESLint 代码检查
npm run preview          # 预览生产构建
```

### 后端 (backend/)
```bash
# 开发服务器
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 测试
pytest                   # 运行所有测试
pytest --cov=app         # 生成覆盖率报告 (要求 80%)
pytest -v                # 详细输出
pytest tests/test_specific.py  # 运行单个测试文件

# 依赖管理
pip install -r requirements.txt
```

### Docker (根目录)
```bash
docker-compose up -d     # 一键启动完整服务
docker-compose logs -f   # 查看日志
docker-compose down      # 停止服务
docker-compose up --build  # 重新构建并启动
```

### Python 命令行版本
```bash
python edf_demo.py                    # 自动检测 ./edf 目录中的文件
python edf_demo.py /path/to/file.edf  # 指定文件路径
python edf_demo.py ./edf/李诗敏1.edf  # 支持中文文件名
```

## 架构设计

### 整体架构
```
用户浏览器 (React Frontend)
    ↕ HTTP/REST API
FastAPI Backend
    ↕ MNE-Python
EDF 文件存储 (backend/storage/)
```

### 前端架构

**状态管理 (Zustand Store)**:
- `frontend/src/store/edfStore.ts` - 全局状态管理
  - 元数据 (metadata)
  - 波形数据 (waveform)
  - 当前时间位置 (currentTime)
  - 选中的通道 (selectedChannels)
  - 时间窗口长度 (windowDuration)
  - 振幅缩放 (amplitudeScale)
  - 书签列表 (bookmarks)

**核心组件**:
- `App.tsx` - 主应用容器 (21KB，核心逻辑)
- `WaveformCanvas.tsx` - 波形画布 (Canvas 渲染，核心可视化组件)
- `OverviewStrip.tsx` - 概览条 (显示完整时间范围)
- `TimeAxis.tsx` - 时间轴
- `AmplitudeAxis.tsx` - 振幅轴
- `ChannelSelector.tsx` - 通道选择器
- `TimeToolbar.tsx` - 时间控制工具栏
- `CursorOverlay.tsx` - 光标覆盖层
- `TimeScrubber.tsx` - 时间滑块
- `ZoomIndicator.tsx` - 缩放指示器
- `ResolutionIndicator.tsx` - 分辨率指示器
- `InteractionHint.tsx` - 交互提示
- `KeyboardShortcuts.tsx` - 键盘快捷键

**API 客户端**:
- `frontend/src/api/edf.ts` - 封装所有后端 API 调用

### 后端架构

**三层架构**:
```
API Routes Layer (路由层)
    ↓ 调用
Services Layer (业务逻辑层)
    ↓ 使用
MNE-Python Library (EDF 解析)
```

**API 路由** (`backend/app/api/routes/`):
- `upload.py` - 文件上传
- `metadata.py` - 元数据获取
- `waveform.py` - 波形数据获取
- `waveform_overview.py` - 概览数据
- `health.py` - 健康检查

**业务逻辑** (`backend/app/services/`):
- `edf_parser.py` - EDF 文件解析 (使用 MNE-Python)
- `file_manager.py` - 文件管理

**API 端点**:
```
GET  /health                          # 健康检查
POST /api/upload/                     # 上传 EDF 文件
GET  /api/metadata/{file_id}          # 获取元数据
GET  /api/waveform/{file_id}          # 获取波形数据
     ?start=10&duration=5&channels=0,1,2
GET  /api/waveform_overview/{file_id} # 获取概览数据
     ?samples_per_second=1.0
```

## 关键技术特性

### 1. 内存优化策略 (重要)

**问题**: 176MB EDF 文件加载到内存需要约 240MB RAM

**解决方案** (在 `edf_parser.py` 中实现):
```python
# 步骤 1: 延迟加载 (preload=False)
raw = mne.io.read_raw_edf(
    file_path,
    preload=False,      # 不加载数据到内存
    encoding='latin1',  # 支持中文文件名
    verbose=False
)

# 步骤 2: 只加载需要的时间段
raw.crop(tmin=start_time, tmax=end_time)

# 步骤 3: 只选择需要的通道
raw.pick_channels(selected_channels)

# 步骤 4: 现在才加载到内存
raw.load_data()
```

**内存对比**:
- 完整加载: ~240 MB
- 加载 10 秒数据: ~12 MB (减少 95%)
- 加载 10 通道 × 10 秒: ~2 MB (减少 99%)

### 2. 中文文件名支持

**必须使用** `encoding='latin1'` 参数读取 EDF 文件:
```python
raw = mne.io.read_raw_edf(file_path, encoding='latin1', preload=False)
```

前端正确处理 UTF-8 编码，无需特殊处理。

### 3. Canvas 渲染优化

**WaveformCanvas.tsx** 使用原生 Canvas API 进行高性能渲染:
- 支持实时缩放、平移、拖拽
- 坐标系统精确对齐 (已修复时间坐标不匹配问题)
- 垂直网格线增强时间参考
- 自动化坐标系统验证测试

**重要修复**:
- 已移除不正确的 0.5 电压缩放因子 (commit: a16c40c)
- X 轴宽度与 TimeAxis 对齐 (commit: 52070a1)
- 改进垂直网格线可见性 (commit: 42d4813)

### 4. 测试覆盖率要求

**前端** (`vitest.config.ts`):
- 环境: jsdom
- 覆盖率要求: 80% (statements/branches/functions/lines)
- 提供者: v8

**后端** (`pyproject.toml`):
- 覆盖率要求: 80%
- 异步模式: auto

## 代码规范

### Git 提交规范

使用 Conventional Commits 格式:
- `feat:` - 新功能
- `fix:` - Bug 修复
- `test:` - 测试相关
- `style:` - 样式改进
- `docs:` - 文档更新
- `refactor:` - 代码重构

**示例**:
```
test(eeg): add automated coordinate system verification tests
fix(waveform): align X-axis width with TimeAxis to fix time coordinate mismatch
style(waveform): improve vertical grid line visibility for better time reference
```

### 测试策略

**前端测试** (`frontend/src/components/__tests__/`):
- 使用 Vitest + Testing Library
- 组件测试: ChannelSelector, OverviewStrip, WaveformCanvas
- 坐标系统验证测试

**后端测试** (`backend/tests/`):
- 使用 Pytest + httpx
- API 端点测试
- 健康检查测试

## 依赖版本注意事项

### 后端依赖 (requirements.txt)

**重要**: 使用以下版本以避免兼容性问题:
```
mne==1.11.0              # 稳定版本，避免使用 1.6.0
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
```

**已知问题**:
- MNE 1.6.0 与 scipy 1.17.0 存在兼容性问题
- 当前使用 MNE 1.11.0 (稳定版本)

### 前端依赖 (package.json)

```json
{
  "react": "^19.2.0",
  "typescript": "~5.9.3",
  "vite": "^7.2.4",
  "zustand": "^5.0.10",
  "uplot": "^1.6.32",
  "vitest": "^4.0.18"
}
```

## 文件结构

```
edf-web/
├── frontend/                    # React 前端应用
│   ├── src/
│   │   ├── App.tsx             # 主应用组件 (21KB)
│   │   ├── App.css             # 主样式文件 (16KB)
│   │   ├── api/edf.ts          # API 客户端
│   │   ├── store/edfStore.ts   # Zustand 状态管理
│   │   ├── components/         # React 组件
│   │   └── test/               # 测试配置
│   ├── package.json
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   └── Dockerfile
│
├── backend/                     # FastAPI 后端服务
│   ├── app/
│   │   ├── main.py             # FastAPI 应用入口
│   │   ├── config.py           # 配置管理
│   │   ├── api/routes/         # API 路由层
│   │   └── services/           # 业务逻辑层
│   ├── tests/                  # 后端测试
│   ├── storage/                # EDF 文件存储
│   ├── requirements.txt
│   └── Dockerfile
│
├── .sisyphus/                   # Sisyphus 项目管理
│   ├── boulder.json            # 活动计划追踪
│   ├── plans/                  # 实施计划文档
│   └── notepads/               # 开发笔记
│
├── docker-compose.yml          # 服务编排配置
├── edf_demo.py                 # Python 命令行版本
├── README.md                   # 项目文档
└── TECHNICAL_RECOMMENDATIONS.md # 技术建议
```

## 常见开发任务

### 添加新的 API 端点

1. 在 `backend/app/api/routes/` 创建新的路由文件
2. 在 `backend/app/services/` 添加业务逻辑
3. 在 `backend/app/main.py` 注册路由
4. 在 `frontend/src/api/edf.ts` 添加客户端调用
5. 编写测试 (前端和后端)

### 添加新的 React 组件

1. 在 `frontend/src/components/` 创建组件文件
2. 使用 Zustand store 访问全局状态
3. 在 `App.tsx` 中引入组件
4. 编写组件测试 (`__tests__/` 目录)
5. 确保测试覆盖率达到 80%

### 修改波形渲染逻辑

1. 主要文件: `frontend/src/components/WaveformCanvas.tsx`
2. 注意坐标系统对齐 (X 轴宽度必须与 TimeAxis 一致)
3. 避免引入不正确的缩放因子
4. 运行坐标系统验证测试确保准确性
5. 测试文件: `frontend/src/components/__tests__/WaveformCanvas.test.tsx`

### 处理大文件

1. 始终使用 `preload=False` 延迟加载
2. 使用 `crop()` 只加载需要的时间段
3. 使用 `pick_channels()` 只选择需要的通道
4. 参考 `backend/app/services/edf_parser.py` 中的实现

## 项目管理

项目使用 Sisyphus 进行任务管理:
- `.sisyphus/boulder.json` - 活动计划追踪
- `.sisyphus/plans/` - 实施计划文档
- `.sisyphus/notepads/` - 开发笔记

当前活动计划: `eeg-critical-issues-fix.md`

## 交互式 API 文档

启动后端服务后，访问:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
