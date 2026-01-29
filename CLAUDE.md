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
- HTTP 客户端: Axios 1.13.2
- 样式框架: Tailwind CSS 4.1.18
- 数据查询: React Query 5.90.20
- 文件上传: React Dropzone 14.3.8
- 工具库: Lodash Debounce 4.0.8

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
  - **信号定义** (signals) - 派生信号列表
  - **信号数据** (signalData) - 计算结果缓存
  - **加载状态** (isLoadingSignals) - 信号计算进度

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
- **`SignalEditor.tsx`** - 信号编辑器 (创建/编辑派生信号)
- **`SignalList.tsx`** - 信号列表 (管理所有派生信号)
- **`SignalExpressionBuilder.tsx`** - 表达式构建器 (可视化表达式编辑)

**API 客户端**:
- `frontend/src/api/edf.ts` - 封装所有后端 API 调用
- **`frontend/src/api/signals.ts`** - 信号管理 API 调用 (验证、计算)

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
- **`signals.py`** - 信号管理 (验证、计算派生信号)

**业务逻辑** (`backend/app/services/`):
- `edf_parser.py` - EDF 文件解析 (使用 MNE-Python)
- `file_manager.py` - 文件管理
- **`signal_calculator.py`** - 信号计算引擎 (表达式求值、数据处理)
- **`expression_validator.py`** - 表达式验证 (语法检查、安全性验证)

**API 端点**:
```
GET  /health                          # 健康检查
POST /api/upload/                     # 上传 EDF 文件
GET  /api/metadata/{file_id}          # 获取元数据
GET  /api/waveform/{file_id}          # 获取波形数据
     ?start=10&duration=5&channels=0,1,2
GET  /api/waveform_overview/{file_id} # 获取概览数据
     ?samples_per_second=1.0

# 信号管理端点
POST /api/signals/validate            # 验证表达式
     Body: {expression: string, channels: string[]}
     Response: {isValid: boolean, referencedChannels: string[], error?: string}

POST /api/signals/calculate           # 计算派生信号
     Body: {
       file_id: string,
       start: number,
       duration: number,
       signals: [{id: string, expression: string, operands: Operand[]}]
     }
     Response: [{
       id: string,
       data: number[],
       times: number[],
       sfreq: number,
       n_samples: number
     }]
```

## 关键技术特性

### 1. 派生信号系统 (Phase 1)

**概念**: 派生信号是通过对原始 EEG 通道进行数学运算得到的新信号。

**支持的操作**:
- 算术运算: `+`, `-`, `*`, `/`
- 括号分组: `(Fp1 - F3) / 2`
- 数值常量: `Fp1 * 0.5`
- NumPy 函数: `np.mean()`, `np.std()`, `np.abs()` 等

**表达式示例**:
```
Fp1 - F3              # 两个通道的差值
(Fp1 + F3) / 2        # 两个通道的平均值
Fp1 * 2 - F3          # 加权组合
np.abs(Fp1 - F3)      # 绝对值差
```

**前端工作流**:
1. 用户在 SignalEditor 中输入表达式
2. ExpressionValidator 实时验证表达式
3. 用户点击保存，信号存储到 Zustand store
4. 信号自动保存到 localStorage (按 file_id 分类)
5. App.tsx 调用后端 `/api/signals/calculate` 计算信号
6. 计算结果存储在 signalData Map 中
7. WaveformCanvas 将派生信号与原始波形合并显示

**后端工作流**:
1. 接收 POST /api/signals/calculate 请求
2. SignalCalculator 加载 EDF 文件 (preload=False)
3. 对每个信号:
   - 验证操作数 (通道索引、名称)
   - 加载所需的通道数据 (crop + pick_channels)
   - 预处理表达式 (替换通道名为数据引用)
   - 在安全命名空间中求值表达式
   - 返回计算结果
4. 响应包含所有信号的数据、时间戳、采样率

**内存优化**:
- 后端只加载所需的时间段和通道
- 前端使用 debounce 避免频繁 API 调用
- 信号数据缓存在 signalData Map 中
- localStorage 存储信号定义 (不存储计算结果)

### 2. 内存优化策略 (重要)

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
# 核心框架
fastapi==0.104.1              # Web 框架
uvicorn[standard]==0.24.0     # ASGI 服务器
pydantic==2.5.0               # 数据验证
pydantic-settings==2.1.0      # 配置管理

# EEG 数据处理
mne==1.11.0                   # 脑电图数据处理 (稳定版本，避免使用 1.6.0)

# 工具库
python-multipart==0.0.6       # 文件上传支持
python-dotenv==1.0.0          # 环境变量管理
aiofiles==23.2.1              # 异步文件操作

# 测试工具
pytest==7.4.3                 # 测试框架
pytest-asyncio==0.21.1        # 异步测试支持
pytest-cov==4.1.0             # 测试覆盖率
httpx==0.25.2                 # HTTP 客户端 (用于测试)
```

**已知问题**:
- MNE 1.6.0 与 scipy 1.17.0 存在兼容性问题
- 当前使用 MNE 1.11.0 (稳定版本)

### 前端依赖 (package.json)

**生产依赖**:
```json
{
  "react": "^19.2.0",                    # React 框架
  "react-dom": "^19.2.0",                # React DOM 渲染
  "typescript": "~5.9.3",                # TypeScript 编译器
  "vite": "^7.2.4",                      # 前端构建工具
  "zustand": "^5.0.10",                  # 状态管理库
  "uplot": "^1.6.32",                    # 高性能图表库
  "axios": "^1.13.2",                    # HTTP 客户端
  "tailwindcss": "^4.1.18",              # CSS 框架
  "@tanstack/react-query": "^5.90.20",   # 数据查询和缓存
  "react-dropzone": "^14.3.8",           # 文件拖拽上传
  "lodash.debounce": "^4.0.8",           # 防抖工具函数
  "autoprefixer": "^10.4.23",            # CSS 前缀自动添加
  "postcss": "^8.5.6"                    # CSS 后处理
}
```

**开发依赖**:
```json
{
  "vitest": "^4.0.18",                   # 单元测试框架
  "@vitest/coverage-v8": "^4.0.18",      # 测试覆盖率
  "@testing-library/react": "^16.3.2",   # React 组件测试
  "@testing-library/jest-dom": "^6.9.1", # DOM 匹配器
  "@testing-library/user-event": "^14.6.1", # 用户交互模拟
  "@vitejs/plugin-react": "^5.1.1",      # Vite React 插件
  "eslint": "^9.39.1",                   # 代码检查
  "@eslint/js": "^9.39.1",               # ESLint 配置
  "typescript-eslint": "^8.46.4",        # TypeScript ESLint
  "eslint-plugin-react-hooks": "^7.0.1", # React Hooks 检查
  "eslint-plugin-react-refresh": "^0.4.24", # React Refresh 检查
  "@types/react": "^19.2.5",             # React 类型定义
  "@types/react-dom": "^19.2.3",         # React DOM 类型定义
  "@types/node": "^24.10.1",             # Node 类型定义
  "@types/lodash.debounce": "^4.0.9",    # Lodash 类型定义
  "jsdom": "^27.4.0",                    # DOM 模拟环境
  "globals": "^16.5.0"                   # 全局变量定义
}
```

## 文件结构

```
edf-web/
├── frontend/                    # React 前端应用
│   ├── src/
│   │   ├── App.tsx             # 主应用容器 (21KB)
│   │   ├── App.css             # 主样式文件 (16KB)
│   │   ├── api/
│   │   │   ├── edf.ts          # EDF 数据 API 调用
│   │   │   └── signals.ts       # 信号管理 API 调用
│   │   ├── store/
│   │   │   └── edfStore.ts     # Zustand 全局状态管理
│   │   ├── types/              # TypeScript 类型定义
│   │   │   ├── signal.ts       # 信号相关类型
│   │   │   ├── waveform.ts     # 波形相关类型
│   │   │   └── api.ts          # API 响应类型
│   │   ├── utils/              # 工具函数
│   │   │   ├── expressionParser.ts    # 表达式解析和验证
│   │   │   ├── expressionExtractor.ts # 操作数提取
│   │   │   └── storageManager.ts      # localStorage 管理
│   │   ├── components/         # React 组件
│   │   │   ├── WaveformCanvas.tsx
│   │   │   ├── OverviewStrip.tsx
│   │   │   ├── TimeAxis.tsx
│   │   │   ├── AmplitudeAxis.tsx
│   │   │   ├── ChannelSelector.tsx
│   │   │   ├── TimeToolbar.tsx
│   │   │   ├── CursorOverlay.tsx
│   │   │   ├── TimeScrubber.tsx
│   │   │   ├── ZoomIndicator.tsx
│   │   │   ├── ResolutionIndicator.tsx
│   │   │   ├── InteractionHint.tsx
│   │   │   ├── KeyboardShortcuts.tsx
│   │   │   ├── SignalEditor.tsx        # 信号编辑器
│   │   │   ├── SignalList.tsx          # 信号列表
│   │   │   ├── SignalExpressionBuilder.tsx # 表达式构建器
│   │   │   └── __tests__/              # 组件测试
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
│   │   ├── api/routes/
│   │   │   ├── upload.py       # 文件上传
│   │   │   ├── metadata.py     # 元数据获取
│   │   │   ├── waveform.py     # 波形数据获取
│   │   │   ├── waveform_overview.py # 概览数据
│   │   │   ├── health.py       # 健康检查
│   │   │   └── signals.py      # 信号管理 (验证、计算)
│   │   ├── services/
│   │   │   ├── edf_parser.py   # EDF 文件解析
│   │   │   ├── file_manager.py # 文件管理
│   │   │   ├── signal_calculator.py    # 信号计算引擎
│   │   │   └── expression_validator.py # 表达式验证
│   │   └── utils/              # 工具函数
│   │       └── storage.py      # 文件存储管理
│   ├── tests/                  # 后端测试
│   │   ├── test_signals.py     # 信号管理测试
│   │   ├── test_api.py         # API 端点测试
│   │   └── test_health.py      # 健康检查测试
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
4. 在 `frontend/src/api/edf.ts` 或 `frontend/src/api/signals.ts` 添加客户端调用
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

### 创建派生信号

1. **前端**:
   - 打开 SignalEditor 组件
   - 输入信号名称 (例如: "Fp1-F3")
   - 输入表达式 (例如: "Fp1 - F3")
   - ExpressionValidator 实时验证表达式
   - 点击保存，信号存储到 Zustand store
   - 信号自动保存到 localStorage

2. **后端**:
   - 前端调用 `POST /api/signals/calculate`
   - SignalCalculator 加载 EDF 文件
   - 验证操作数 (通道名称、索引)
   - 加载所需的通道数据
   - 预处理表达式 (替换通道名)
   - 在安全命名空间中求值表达式
   - 返回计算结果

3. **表达式语法**:
   ```
   # 基本运算
   Fp1 - F3              # 减法
   (Fp1 + F3) / 2        # 平均值
   Fp1 * 0.5 + F3 * 0.5  # 加权组合

   # NumPy 函数
   np.abs(Fp1 - F3)      # 绝对值
   np.mean([Fp1, F3])    # 平均值
   np.std(Fp1)           # 标准差
   ```

### 修改表达式验证规则

1. **前端验证** (`frontend/src/utils/expressionParser.ts`):
   - 修改 `validateExpression()` 函数
   - 更新 `checkBasicSyntax()` 检查规则
   - 添加新的操作符支持

2. **后端验证** (`backend/app/services/expression_validator.py`):
   - 修改 `validate_expression()` 函数
   - 更新 `_check_valid_operators()` 检查规则
   - 添加新的函数支持到 `_extract_functions()`

3. **安全性考虑**:
   - 只允许特定的 NumPy 函数
   - 禁止文件 I/O、系统命令、网络操作
   - 限制表达式长度 (≤ 500 字符)
   - 验证所有通道名称存在

### 调试信号计算

**前端调试**:
```typescript
// 在 App.tsx 中添加日志
console.log('Signals:', signals);
console.log('Signal Data:', signalData);
console.log('Merged Waveform:', mergedWaveformData);

// 检查 localStorage
const stored = localStorage.getItem(`signals-${fileId}`);
console.log('Stored Signals:', JSON.parse(stored || '[]'));
```

**后端调试**:
```python
# 在 signal_calculator.py 中添加日志
import logging
logger = logging.getLogger(__name__)

logger.debug(f"Loading file: {file_path}")
logger.debug(f"Operands: {operands}")
logger.debug(f"Expression: {expression}")
logger.debug(f"Result shape: {result.shape}")
```

**常见问题**:
1. **表达式验证失败**: 检查通道名称是否正确，括号是否平衡
2. **计算结果为 NaN**: 检查数据是否包含无效值，考虑使用 `np.nan_to_num()`
3. **内存不足**: 减少时间窗口长度或选择更少的通道
4. **API 超时**: 增加请求超时时间，或分批计算多个信号

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

## 派生信号系统详解

### 表达式语法规范

**支持的操作符**:
```
+   加法
-   减法
*   乘法
/   除法
()  括号分组
```

**支持的 NumPy 函数**:
```
np.abs()      绝对值
np.mean()     平均值
np.std()      标准差
np.min()      最小值
np.max()      最大值
np.sum()      求和
np.sqrt()     平方根
np.log()      自然对数
np.exp()      指数函数
```

**表达式示例**:
```
# 简单差值
Fp1 - F3

# 平均值
(Fp1 + F3) / 2

# 加权组合
Fp1 * 0.7 + F3 * 0.3

# 使用 NumPy 函数
np.abs(Fp1 - F3)
np.mean([Fp1, F3, Fz])
np.std(Fp1)

# 复杂表达式
(np.abs(Fp1 - F3) + np.abs(F3 - Fz)) / 2
```

**表达式限制**:
- 最大长度: 500 字符
- 必须包含至少一个通道名称
- 所有通道名称必须存在于 EDF 文件中
- 括号必须平衡
- 不支持赋值、导入、函数定义等

### 前端信号管理流程

**1. 信号编辑器 (SignalEditor.tsx)**:
- 模态对话框，用于创建或编辑派生信号
- 输入字段: 名称、表达式、描述、颜色
- 实时表达式验证
- 显示引用的通道列表
- 保存/取消按钮

**2. 信号列表 (SignalList.tsx)**:
- 显示所有已创建的派生信号
- 搜索和过滤功能
- 启用/禁用信号的复选框
- 编辑和删除按钮
- 信号元数据显示 (创建时间、修改时间)

**3. 表达式构建器 (SignalExpressionBuilder.tsx)**:
- 可视化表达式编辑界面
- 通道选择下拉菜单
- 操作符按钮
- 实时验证反馈
- 表达式预览

**4. 状态管理 (edfStore.ts)**:
```typescript
// 信号定义
signals: Signal[]

// 计算结果
signalData: Map<string, SignalComputationResult>

// 加载状态
isLoadingSignals: boolean

// 方法
addSignal(signal: Signal): void
updateSignal(id: string, updates: Partial<Signal>): void
deleteSignal(id: string): void
toggleSignal(id: string): void
setSignalData(signalId: string, data: SignalComputationResult): void
setSignalDataBatch(results: SignalComputationResult[]): void
```

**5. 持久化 (storageManager.ts)**:
- 信号定义保存到 localStorage
- 按 file_id 分类存储
- 自动加载和保存
- 错误处理和恢复

### 后端信号计算流程

**1. 表达式验证 (expression_validator.py)**:
```python
def validate_expression(expression: str, available_channels: List[str]) -> Dict:
    """
    验证表达式的有效性

    检查项:
    - 表达式长度 ≤ 500
    - 括号平衡
    - 有效的操作符
    - 有效的通道名称
    - 有效的 NumPy 函数
    """
```

**2. 信号计算 (signal_calculator.py)**:
```python
def calculate_signals(
    self,
    signals: List[Dict],
    file_path: str,
    start_time: float,
    duration: float
) -> List[Dict]:
    """
    计算多个派生信号

    步骤:
    1. 加载 EDF 文件 (preload=False)
    2. 对每个信号:
       a. 验证操作数
       b. 加载所需通道数据
       c. 预处理表达式
       d. 求值表达式
       e. 返回结果
    """
```

**3. API 端点 (signals.py)**:
```python
@router.post("/validate")
async def validate_expression(request: ValidateRequest) -> ValidateResponse:
    """验证表达式语法和语义"""

@router.post("/calculate")
async def calculate_signals(request: CalculateRequest) -> CalculateResponse:
    """计算派生信号数据"""
```

### 安全性考虑

**表达式求值安全**:
- 使用受限的命名空间: `{"channels": data, "np": numpy, "__builtins__": {}}`
- 禁止访问文件系统、网络、系统命令
- 禁止导入模块、定义函数、赋值变量
- 只允许特定的 NumPy 函数

**输入验证**:
- 表达式长度限制 (≤ 500 字符)
- 通道名称白名单检查
- 操作符白名单检查
- 括号平衡检查

**错误处理**:
- 捕获所有异常
- 返回有意义的错误消息
- 不暴露系统内部信息
- 记录所有错误用于调试

### 性能优化

**前端优化**:
- 使用 debounce 避免频繁 API 调用 (300ms)
- 使用 useMemo 缓存验证结果
- 使用 Map 存储信号数据 (O(1) 查询)
- 虚拟滚动处理大量信号列表

**后端优化**:
- 延迟加载 EDF 文件 (preload=False)
- 只加载所需的时间段 (crop)
- 只加载所需的通道 (pick_channels)
- 缓存 EDF 文件句柄 (可选)

**内存使用**:
- 完整 EDF 加载: ~240 MB
- 10 秒时间段: ~12 MB (减少 95%)
- 10 通道 × 10 秒: ~2 MB (减少 99%)

## 调试和故障排除

### 前端调试

**启用详细日志**:
```typescript
// 在 App.tsx 顶部添加
const DEBUG = true;

const log = (message: string, data?: any) => {
  if (DEBUG) {
    console.log(`[EDF] ${message}`, data);
  }
};

// 使用
log('Signals loaded', signals);
log('Signal data updated', signalData);
```

**检查状态**:
```typescript
// 在浏览器控制台
// 查看 Zustand store
import { useEDFStore } from './store/edfStore';
const store = useEDFStore.getState();
console.log('Store state:', store);

// 查看 localStorage
localStorage.getItem('signals-file-123')
```

**常见前端问题**:

| 问题 | 原因 | 解决方案 |
|------|------|--------|
| 表达式验证失败 | 通道名称错误或括号不平衡 | 检查通道名称拼写，使用括号匹配工具 |
| 信号不显示 | 计算失败或数据为空 | 检查浏览器控制台错误，查看 API 响应 |
| localStorage 满 | 存储过多信号定义 | 删除不需要的信号或清空 localStorage |
| 性能缓慢 | 信号过多或时间窗口过长 | 减少信号数量或缩短时间窗口 |

### 后端调试

**启用详细日志**:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# 在 signal_calculator.py 中
logger.debug(f"Loading file: {file_path}")
logger.debug(f"Operands: {operands}")
logger.debug(f"Expression: {expression}")
logger.debug(f"Result shape: {result.shape}")
```

**测试表达式计算**:
```python
from backend.app.services.signal_calculator import SignalCalculator

calc = SignalCalculator()
result = calc.calculate_signals(
    signals=[{
        'id': 'test-1',
        'expression': 'Fp1 - F3',
        'operands': [...]
    }],
    file_path='/path/to/file.edf',
    start_time=0,
    duration=5
)
print(result)
```

**常见后端问题**:

| 问题 | 原因 | 解决方案 |
|------|------|--------|
| 文件未找到 | file_id 不正确 | 检查文件是否存在于 storage 目录 |
| 通道索引超出范围 | 操作数中的通道索引错误 | 验证通道索引是否在有效范围内 |
| 表达式求值失败 | 表达式语法错误或数据问题 | 检查表达式语法，查看数据是否包含 NaN |
| 内存不足 | 时间窗口过长或通道过多 | 减少时间窗口或选择更少的通道 |
| API 超时 | 计算耗时过长 | 增加超时时间或优化表达式 |

### 测试信号功能

**前端测试**:
```bash
# 运行所有测试
npm run test

# 运行特定测试文件
npm run test SignalEditor.test.tsx

# 生成覆盖率报告
npm run test:coverage
```

**后端测试**:
```bash
# 运行所有测试
pytest

# 运行特定测试文件
pytest backend/tests/test_signals.py

# 生成覆盖率报告
pytest --cov=app backend/tests/
```

**手动测试步骤**:
1. 上传 EDF 文件
2. 打开信号编辑器
3. 输入有效表达式 (例如: "Fp1 - F3")
4. 验证表达式通过
5. 保存信号
6. 检查信号是否出现在列表中
7. 检查波形画布中是否显示派生信号
8. 编辑信号并验证更新
9. 删除信号并验证移除
10. 刷新页面并验证信号持久化

### 性能分析

**前端性能**:
```typescript
// 测量 API 调用时间
const start = performance.now();
await calculateSignals(signals);
const duration = performance.now() - start;
console.log(`Signal calculation took ${duration}ms`);
```

**后端性能**:
```python
import time

start = time.time()
result = calculator.calculate_signals(...)
duration = time.time() - start
logger.info(f"Signal calculation took {duration:.2f}s")
```

**优化建议**:
- 如果 API 调用 > 1000ms，考虑优化表达式或减少数据量
- 如果内存使用 > 500MB，考虑使用流式处理
- 如果 CPU 使用 > 80%，考虑并行化计算

## 已知限制和未来改进

### 当前限制

1. **表达式复杂度**: 不支持条件语句、循环、自定义函数
2. **数据类型**: 只支持数值数据，不支持字符串或布尔值
3. **实时计算**: 每次时间窗口变化都需要重新计算
4. **并发计算**: 后端不支持并行计算多个信号
5. **缓存**: 没有缓存计算结果，每次都重新计算

### 未来改进方向

1. **Phase 2**: 支持更复杂的表达式 (条件语句、循环)
2. **Phase 3**: 实现结果缓存和增量计算
3. **Phase 4**: 支持自定义函数和宏
4. **Phase 5**: 实现并行计算和流式处理
5. **Phase 6**: 支持信号导出和分享
