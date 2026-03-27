# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

EEG/脑电图数据可视化 Web 应用，支持 EDF/EDF+ 文件格式。前后端分离架构。

**核心技术栈**:
- 前端: React 19.2.0 + TypeScript 5.9.3 + Vite 7.2.4 + Zustand 5.0.10 + Canvas API
- 后端: FastAPI 0.104.1 + MNE-Python 1.11.0
- 通信: REST API (Axios)
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
  - **信号定义** (signals) - 派生信号列表
  - **信号数据** (signalData) - 计算结果缓存
  - **加载状态** (isLoadingSignals) - 信号计算进度

**核心组件** (25个组件):
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
- **`SelectionInfo.tsx`** - 选区统计信息 (最小值/最大值/平均值/范围)
- **`StatsView.tsx`** - 时域分析统计 (均值/标准差/RMS/峰度/偏度)
- **`FrequencyView.tsx`** - 频带功率分析 (Delta/Theta/Alpha/Beta/Gamma)
- **`ModeEditor.tsx`** - 模式编辑器 (创建/编辑自定义分析模式)
- **`ModeSelector.tsx`** - 模式选择器 (智能推荐和兼容性检查)
- **`ModeCard.tsx`** - 模式卡片 (显示模式信息)
- **`CompatibilityWarning.tsx`** - 兼容性警告 (显示模式兼容性问题)
- **`PreprocessSelector.tsx`** - 预处理方法选择器 (去漂移/滤波)
- **`AdvancedAnalysisModal.tsx`** - 高级分析模态框 (原始与预处理信号对比)

**API 客户端**:
- `frontend/src/api/edf.ts` - 封装 EDF 相关 API 调用 (文件上传、元数据、波形、信号管理、分析)
- `frontend/src/api/mode.ts` - 封装模式管理 API 调用 (CRUD、兼容性检查、推荐)

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
- **`analysis.py`** - 数据分析 (时域分析/频带功率/功率谱密度)
- **`modes.py`** - 模式管理 (CRUD、兼容性检查、推荐、导入导出)

**业务逻辑** (`backend/app/services/`):
- `edf_parser.py` - EDF 文件解析 (使用 MNE-Python)
- `file_manager.py` - 文件管理
- **`signal_calculator.py`** - 信号计算引擎 (表达式求值、数据处理)
- **`analysis_service.py`** - 分析服务 (时域/频域/综合分析)
- **`mode_service.py`** - 模式管理服务 (模式存储、兼容性检查、推荐系统)
- **`preprocessing.py`** - 信号预处理 (去漂移、高通滤波、基线校正)
- **`auto_preprocess.py`** - 自动预处理流水线 (重参考、Notch滤波、伪迹检测)

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

# 数据分析端点
POST /api/analysis/time-domain        # 时域分析
     Body: {file_id: string, start: number, duration: number, channels: string[]}
     Response: {channelName: {min, max, mean, std, rms, peakToPeak, kurtosis, skewness, nSamples}}

POST /api/analysis/band-power         # 频带功率分析
     Body: {file_id: string, start: number, duration: number, channels: string[]}
     Response: {channelName: {delta, theta, alpha, beta, gamma: {absolute, relative}}}

POST /api/analysis/psd                # 功率谱密度分析
     Body: {file_id: string, start: number, duration: number, channels: string[]}
     Response: {channelName: {frequencies: number[], psd: number[]}}

POST /api/analysis/comprehensive      # 综合分析
     Body: {file_id: string, start: number, duration: number, channels: string[]}
     Response: {timeDomain: {...}, frequency: {bandPowers: {...}, psd: {...}}, selectionStart, selectionEnd, duration}

# 模式管理端点
GET  /api/modes/                      # 获取所有模式 (支持分类、分页过滤)
GET  /api/modes/categories            # 获取所有模式分类
GET  /api/modes/{mode_id}             # 获取单个模式详情
POST /api/modes/                      # 创建新模式
PUT  /api/modes/{mode_id}             # 更新模式 (仅自定义模式)
DELETE /api/modes/{mode_id}           # 删除模式 (仅自定义模式)
POST /api/modes/check-compatibility   # 检查模式兼容性
POST /api/modes/batch-check-compatibility  # 批量兼容性检查
POST /api/modes/recommend             # 获取推荐模式
POST /api/modes/{mode_id}/use         # 记录模式使用
GET  /api/modes/{mode_id}/stats       # 获取模式使用统计
POST /api/modes/{mode_id}/favorite    # 切换收藏状态
POST /api/modes/{mode_id}/duplicate   # 复制模式
GET  /api/modes/{mode_id}/export      # 导出模式 (JSON)
POST /api/modes/import                # 导入模式
POST /api/modes/{mode_id}/apply       # 应用模式到文件
POST /api/modes/{mode_id}/reset       # 重置模式为默认配置
```

## 关键技术特性

### 1. 派生信号系统

派生信号通过对原始 EEG 通道进行数学运算得到新信号。

**表达式语法**: `+`, `-`, `*`, `/`, `()`, NumPy 函数 (`np.abs`, `np.mean`, `np.std` 等)
```
Fp1 - F3              # 差值
(Fp1 + F3) / 2        # 平均值
np.abs(Fp1 - F3)      # 绝对值
```

**前端流程**: SignalEditor → ExpressionValidator → Zustand Store → localStorage → API 调用 → signalData Map
**后端流程**: 接收请求 → SignalCalculator → EDF 加载 (preload=False) → 表达式求值 → 返回结果

### 2. 信号预处理系统 (新增)

提供信号预处理功能，支持去漂移、滤波等操作。

**预处理方法** (`backend/app/services/preprocessing.py`):
- `none` - 无预处理，保持原始信号
- `linear_detrend` - 线性去漂移，去除线性趋势
- `polynomial_detrend` - 多项式去漂移，去除复杂趋势
- `highpass_filter` - 高通滤波 (Butterworth, 默认 0.5Hz)
- `bandpass_filter` - 带通滤波 (0.5-50Hz)
- `baseline_correction` - 基线校正 (Savitzky-Golay)

**自动预处理流水线** (`backend/app/services/auto_preprocess.py`):
完整的 EEG 预处理流程，包括：
- 通道类型识别 (EEG/EOG/EMG)
- 重参考 (平均参考/乳突参考)
- Notch 滤波 (去除 50Hz 工频干扰)
- 带通滤波 (默认 0.5-50Hz)
- 伪迹检测 (EOG/EMG/Flat/Drift/Jump)
- 伪迹标记 (MNE Annotations)

**前端组件**:
- `PreprocessSelector.tsx` - 预处理方法选择器
- `AdvancedAnalysisModal.tsx` - 高级分析模态框 (对比原始与预处理后信号)

### 3. 数据分析系统

**时域分析** (`SelectionInfo.tsx`, `StatsView.tsx`):
- 基本统计: 最小值、最大值、平均值、范围
- 高级统计: 标准差、均方根 (RMS)、峰度、偏度

**频域分析** (`FrequencyView.tsx`):
- 频带功率: Delta (0.5-4Hz), Theta (4-8Hz), Alpha (8-13Hz), Beta (13-30Hz), Gamma (30-100Hz)
- 绝对功率 (µV²) 和相对功率 (%)
- 功率谱密度 (PSD): 频率-功率分布曲线

### 4. 模式管理系统

模式是一组预配置的 EEG 分析设置，包括通道选择、视图参数、派生信号配置等。

**模式分类**: `clinical` (临床), `research` (科研), `education` (教学), `custom` (自定义)

**核心功能**: CRUD 操作、兼容性检查、智能推荐、导入导出、使用统计

**内置模式**:
1. 临床标准模式 - 8 通道标准 EEG 布局
2. 频谱研究模式 - 专注于频域分析
3. 基础教学模式 - 简化的 2 通道视图

**后端存储**:
- 自定义模式: `backend/storage/modes/custom_modes.json`
- 使用统计: `backend/storage/modes/usage_stats.json`

### 5. 内存优化 (关键)

176MB EDF 文件完整加载需要 ~240MB RAM。优化方案：
```python
# edf_parser.py 中的实现
raw = mne.io.read_raw_edf(file_path, preload=False, encoding='latin1')
raw.crop(tmin=start_time, tmax=end_time)  # 只加载时间段
raw.pick_channels(selected_channels)      # 只选择通道
raw.load_data()                           # 现在才加载
```

**内存对比**: 完整 ~240MB → 10秒数据 ~12MB (↓95%) → 10通道×10秒 ~2MB (↓99%)

### 6. 中文文件名支持

必须使用 `encoding='latin1'` 参数读取 EDF 文件。前端 UTF-8 无需特殊处理。

### 7. Canvas 渲染

`WaveformCanvas.tsx` 使用原生 Canvas API。注意坐标系统对齐 (X 轴宽度必须与 TimeAxis 一致)。
已修复: 0.5 电压缩放因子 (a16c40c)、X 轴对齐 (52070a1)、网格线可见性 (42d4813)

### 8. 测试覆盖率

**前端 (Vitest)**:
- 测试文件: 13 个
- 测试用例: 301 个
- 覆盖率: 语句 84.77%, 分支 75.69%, 函数 85.25%, 行 85.87%
- 测试框架: Vitest + Testing Library (jsdom, v8 coverage)

**后端 (Pytest)**:
- 测试框架: Pytest + httpx
- 覆盖率要求: 80%
- 异步模式: asyncio: auto

**测试文件结构**:
```
frontend/src/
├── api/__tests__/
│   └── edf.test.ts (22 tests) - API 调用层测试
├── components/__tests__/
│   ├── WaveformCanvas.test.tsx (22 tests)
│   ├── WaveformCanvas.coordinate-verification.test.tsx (9 tests)
│   ├── SignalEditor.test.tsx (22 tests)
│   ├── SignalList.test.tsx (21 tests)
│   ├── SignalExpressionBuilder.test.tsx (26 tests)
│   ├── OverviewStrip.test.tsx (16 tests)
│   └── ChannelSelector.test.tsx (30 tests)
├── store/__tests__/
│   └── edfStore.test.ts (51 tests) - Zustand store 状态管理测试
└── utils/__tests__/
    ├── signalStorage.test.ts (24 tests) - localStorage 操作测试
    ├── expressionParser.test.ts (35 tests) - 表达式解析测试
    └── statsCalculator.test.ts (21 tests) - 统计计算测试
```

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

**前端测试** (`frontend/src/`):
- 使用 Vitest + Testing Library
- 组件测试: 所有 23 个组件的单元测试
- 状态管理测试: Zustand store 完整测试 (51 tests + 模式管理测试)
- API 层测试: 所有 API 调用函数的 Mock 测试 (22 tests + 模式 API 测试)
- 工具函数测试: 表达式解析、统计计算、localStorage 操作、模式兼容性检查、模式推荐
- 坐标系统验证测试: 专门的坐标对齐测试套件
- 集成测试: 模式应用端到端测试

**后端测试** (`backend/tests/`):
- 使用 Pytest + httpx
- API 端点测试: 所有路由的完整测试 (包括模式管理 API)
- 业务逻辑测试: 信号计算、分析服务、模式兼容性检查
- 健康检查测试: 系统状态监控
- 模式管理测试: 完整的 CRUD 操作、兼容性检查、推荐系统测试 (73 tests)

**测试开发方法论 (TDD)**:
1. 红色阶段: 先编写失败的测试用例
2. 绿色阶段: 实现最小代码使测试通过
3. 重构阶段: 优化代码结构
4. 覆盖率要求: 所有新增代码必须达到 80% 覆盖率

## 依赖版本注意事项

**后端**:
- `mne==1.11.0` (避免 1.6.0，与 scipy 1.17.0 有兼容性问题)
- `fastapi==0.104.1`, `uvicorn[standard]==0.24.0`

**前端**:
- `react@^19.2.0`, `typescript@~5.9.3`, `vite@^7.2.4`
- `zustand@^5.0.10`, `axios@^1.13.2`, `tailwindcss@^4.1.18`

## 文件结构

```
edf-web/
├── frontend/                    # React 前端
│   ├── src/
│   │   ├── App.tsx             # 主应用容器
│   │   ├── api/
│   │   │   ├── edf.ts          # EDF API 调用
│   │   │   ├── mode.ts         # 模式管理 API 调用
│   │   │   └── __tests__/      # API 测试
│   │   ├── store/
│   │   │   ├── edfStore.ts     # Zustand 全局状态 (包含模式管理)
│   │   │   └── __tests__/      # Store 测试
│   │   ├── utils/
│   │   │   ├── expressionParser.ts  # 表达式验证
│   │   │   ├── signalStorage.ts     # localStorage 操作
│   │   │   ├── statsCalculator.ts   # 统计计算
│   │   │   ├── modeCompatibilityChecker.ts  # 模式兼容性检查
│   │   │   ├── modeRecommender.ts  # 模式推荐算法
│   │   │   └── __tests__/      # 工具函数测试
│   │   ├── types/
│   │   │   ├── signal.ts       # 信号类型定义
│   │   │   ├── analysis.ts     # 分析类型定义
│   │   │   ├── mode.ts         # 模式类型定义
│   │   │   └── __tests__/      # 类型测试
│   │   └── components/         # React 组件 (25 个)
│   │       ├── WaveformCanvas.tsx
│   │       ├── SignalEditor.tsx
│   │       ├── SignalList.tsx
│   │       ├── SignalExpressionBuilder.tsx
│   │       ├── ModeEditor.tsx      # 模式编辑器
│   │       ├── ModeSelector.tsx    # 模式选择器
│   │       ├── ModeCard.tsx        # 模式卡片
│   │       ├── CompatibilityWarning.tsx  # 兼容性警告
│   │       ├── SelectionInfo.tsx       # 选区统计
│   │       ├── StatsView.tsx           # 时域分析
│   │       ├── FrequencyView.tsx       # 频带分析
│   │       ├── PreprocessSelector.tsx  # 预处理选择器
│   │       ├── AdvancedAnalysisModal.tsx  # 高级分析模态框
│   │       ├── OverviewStrip.tsx
│   │       ├── ChannelSelector.tsx
│   │       ├── TimeAxis.tsx
│   │       ├── AmplitudeAxis.tsx
│   │       ├── TimeToolbar.tsx
│   │       ├── CursorOverlay.tsx
│   │       ├── TimeScrubber.tsx
│   │       ├── ZoomIndicator.tsx
│   │       ├── ResolutionIndicator.tsx
│   │       ├── InteractionHint.tsx
│   │       ├── KeyboardShortcuts.tsx
│   │       └── __tests__/      # 组件测试
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                     # FastAPI 后端
│   ├── app/
│   │   ├── main.py             # 应用入口
│   │   ├── config.py           # 配置管理
│   │   ├── models/             # 数据模型
│   │   │   └── mode.py         # 模式相关 Pydantic 模型
│   │   ├── api/routes/         # API 路由
│   │   │   ├── signals.py      # 信号管理
│   │   │   ├── analysis.py     # 数据分析
│   │   │   ├── modes.py        # 模式管理
│   │   │   ├── upload.py       # 文件上传
│   │   │   ├── metadata.py     # 元数据
│   │   │   ├── waveform.py     # 波形数据
│   │   │   └── waveform_overview.py
│   │   ├── services/
│   │   │   ├── edf_parser.py   # EDF 解析
│   │   │   ├── signal_calculator.py  # 信号计算
│   │   │   ├── analysis_service.py   # 分析服务
│   │   │   ├── mode_service.py # 模式管理服务
│   │   │   ├── preprocessing.py  # 信号预处理
│   │   │   ├── auto_preprocess.py # 自动预处理流水线
│   │   │   └── file_manager.py # 文件管理
│   │   └── utils/
│   │       └── expression_validator.py  # 表达式验证
│   ├── tests/                  # 后端测试
│   │   ├── test_signals_api.py
│   │   ├── test_analysis_api.py
│   │   ├── test_modes_api.py  # 模式管理 API 测试
│   │   ├── test_signal_calculator.py
│   │   ├── test_analysis_service.py
│   │   └── conftest.py
│   ├── storage/                # 文件存储
│   │   ├── modes/              # 模式数据存储
│   │   │   ├── custom_modes.json  # 自定义模式
│   │   │   └── usage_stats.json   # 使用统计
│   │   └── [edf files]         # EDF 文件存储
│   └── requirements.txt
│
├── docker-compose.yml
└── edf_demo.py                 # 命令行版本
```

## 常见开发任务

### 添加 API 端点
1. `backend/app/api/routes/` 创建路由文件
2. `backend/app/services/` 添加业务逻辑
3. `backend/app/main.py` 注册路由
4. `frontend/src/api/edf.ts` 添加客户端调用 (信号相关 API 也在此文件)
5. 编写测试

### 添加 React 组件
1. `frontend/src/components/` 创建组件
2. 使用 Zustand store 访问状态
3. `App.tsx` 引入组件
4. `__tests__/` 编写测试 (覆盖率 ≥ 80%)

### 修改波形渲染
- 主文件: `frontend/src/components/WaveformCanvas.tsx`
- 注意: X 轴宽度必须与 TimeAxis 对齐，避免引入不正确的缩放因子
- 测试: `frontend/src/components/__tests__/WaveformCanvas.test.tsx`

### 处理大文件
- 始终使用 `preload=False` + `crop()` + `pick_channels()`
- 参考 `backend/app/services/edf_parser.py`

### 创建派生信号
- 前端: SignalEditor → 表达式验证 → Zustand Store → localStorage
- 后端: `POST /api/signals/calculate` → SignalCalculator → 安全求值
- 表达式语法: `Fp1 - F3`, `(Fp1 + F3) / 2`, `np.abs(Fp1 - F3)`

### 修改表达式验证
- 前端: `frontend/src/utils/expressionParser.ts` (ExpressionValidator)
- 后端: `backend/app/utils/expression_validator.py` (validate_expression)
- 安全性: 只允许特定 NumPy 函数，禁止文件 I/O 和系统命令，限制表达式 ≤ 500 字符

### 管理分析模式
- 前端: ModeEditor → ModeSelector → 兼容性检查 → 应用模式
- 后端: `GET /api/modes/` 获取模式 → `POST /api/modes/check-compatibility` 检查兼容性 → `POST /api/modes/{mode_id}/use` 记录使用
- 模式配置包含: 通道选择、视图参数、派生信号列表、分析设置
- 兼容性检查: 必需通道、最小采样率、配置冲突检测

## 项目管理

- `.sisyphus/boulder.json` - 活动计划追踪
- `.sisyphus/plans/` - 实施计划文档
- API 文档: http://localhost:8000/docs (Swagger UI)

## 调试

**前端**: `console.log` 检查 Zustand store 状态，查看 localStorage 中的信号数据
**后端**: `logging.basicConfig(level=logging.DEBUG)` 启用详细日志

**常见问题**:
| 问题 | 解决方案 |
|------|--------|
| 表达式验证失败 | 检查通道名称、括号平衡 |
| 信号不显示 | 检查浏览器控制台、API 响应 |
| 文件未找到 | 检查 storage 目录 |
| 内存不足 | 减少时间窗口或通道数量 |
| API 超时 | 增加超时时间或优化表达式 |

## 常见问题

**Q: 支持哪些 NumPy 函数？**
A: `np.abs`, `np.mean`, `np.std`, `np.min`, `np.max`, `np.sum`, `np.sqrt`, `np.log`, `np.exp`

**Q: 如何添加新函数？**
A: 修改 `backend/app/utils/expression_validator.py` 中的白名单

**Q: 派生信号数据会被保存吗？**
A: 信号定义保存到 localStorage，计算结果每次重新计算

**Q: 支持多少个派生信号？**
A: 理论无限制，建议不超过 50 个（性能考虑）

**Q: 模式和派生信号有什么区别？**
A: 模式是完整的配置方案，包含通道选择、视图参数、分析设置和预定义的派生信号；派生信号是单个数学表达式计算的结果。一个模式可以包含多个派生信号配置。

**Q: 如何创建自定义模式？**
A: 点击模式选择器旁的 "+" 按钮，在 ModeEditor 中配置通道、视图参数和派生信号，保存后会创建新的自定义模式。

**Q: 内置模式可以修改或删除吗？**
A: 内置模式 (isBuiltIn: true) 不能修改或删除，但可以复制后创建自定义版本。

**Q: 模式兼容性检查如何工作？**
A: 系统检查模式定义的必需通道 (requiredChannels) 是否在当前 EDF 文件中可用，以及采样率是否满足最小要求 (minSamplingRate)。

**Q: 表达式求值安全吗？**
A: 后端使用严格的白名单机制，只允许特定的 NumPy 函数，禁止文件 I/O 和系统命令，限制表达式长度 ≤ 500 字符，确保求值安全。

## 安全特性

### 表达式求值安全

后端实现严格的表达式验证和安全求值机制 (`backend/app/utils/expression_validator.py`):

1. **白名单机制**: 只允许特定的 NumPy 函数 (`np.abs`, `np.mean`, `np.std`, `np.min`, `np.max`, `np.sum`, `np.sqrt`, `np.log`, `np.exp`)
2. **表达式长度限制**: 最大 500 字符
3. **语法验证**: 检查括号平衡、操作符序列
4. **文件 I/O 禁止**: 表达式中不允许任何文件操作
5. **系统命令禁止**: 表达式中不允许执行系统命令

### API 安全

- **内置模式保护**: 内置模式不能通过 API 修改或删除 (HTTP 403)
- **错误消息安全**: 错误消息不泄露敏感的系统信息
- **输入清理**: 所有用户输入都经过 Pydantic 验证
