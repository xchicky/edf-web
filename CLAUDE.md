# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

EEG/脑电图数据可视化 Web 应用，支持 EDF/EDF+ 文件格式。前后端分离架构。

**核心技术栈**:
- 前端: React 19.2.0 + TypeScript 5.9.3 + Vite 7.2.4 + Zustand 5.0.10 + TanStack Query 5.90.20 + Canvas API + uPlot 1.6.32
- 后端: FastAPI 0.104.1 + MNE-Python 1.11.0
- 通信: REST API (Axios)
- 容器化: Docker + Docker Compose

## 开发命令

### 前端 (frontend/)
```bash
npm run dev              # 启动开发服务器 (http://localhost:5173, proxy → :8000)
npm run build            # TypeScript 编译 + Vite 构建
npm run test             # 运行 Vitest 单元测试
npm run test:coverage    # 生成测试覆盖率报告 (要求 80%)
npm run lint             # ESLint 代码检查
npm run test:e2e         # Playwright E2E 测试
npm run test:e2e:headed  # Playwright E2E (有头模式)
npm run test:e2e:ui      # Playwright E2E (UI 模式)
npm run test:e2e:debug   # Playwright E2E (调试模式)
npm run test:e2e:report  # 查看 Playwright 测试报告
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

**核心组件**: 所有组件位于 `frontend/src/components/`，约 27 个。关键组件：
- `App.tsx` - 主应用容器 (核心逻辑)
- `WaveformCanvas.tsx` - 波形画布 (Canvas 渲染，核心可视化组件)
- `SignalEditor.tsx` / `SignalList.tsx` / `SignalExpressionBuilder.tsx` - 派生信号系统
- `ModeEditor.tsx` / `ModeSelector.tsx` / `ModeCard.tsx` / `CompatibilityWarning.tsx` - 模式管理
- `SelectionInfo.tsx` / `StatsView.tsx` / `FrequencyView.tsx` - 数据分析面板
- `AnnotationLayer.tsx` / `AnnotationPanel.tsx` - 标注系统 (伪迹/异常标注展示与管理)
- `PreprocessSelector.tsx` / `AdvancedAnalysisModal.tsx` - 预处理与高级分析
- `advanced-analysis/SignalComparisonView.tsx` - 信号对比视图 (原始 vs 预处理后)

**独立页面** (`frontend/src/pages/`):
- `AdvancedAnalysisPage.tsx` - 高级分析独立页面，支持在新窗口中打开，进行原始信号和预处理后信号的对比分析

**API 客户端**:
- `frontend/src/api/edf.ts` - EDF 相关 API (上传、元数据、波形、信号、分析)
- `frontend/src/api/mode.ts` - 模式管理 API (CRUD、兼容性检查、推荐)
- `frontend/src/api/annotations.ts` - 标注 API (生成、查询、用户标注 CRUD)

**类型定义** (`frontend/src/types/`):
- `signal.ts`, `analysis.ts`, `mode.ts`, `annotation.ts`

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
- `signals.py` - 信号管理 (验证、计算派生信号)
- `analysis.py` - 数据分析 (时域分析/频带功率/功率谱密度)
- `modes.py` - 模式管理 (CRUD、兼容性检查、推荐、导入导出)
- `band_analysis.py` - 频段波形识别分析 (频段分解、优势频段识别、时间分段)
- `anomaly_detection.py` - 异常波形检测 (棘波/尖波/棘慢复合波/慢波/节律异常)
- `annotations.py` - 标注系统 (统一标注格式、生成/查询/用户标注管理)

**业务逻辑** (`backend/app/services/`):
- `edf_parser.py` - EDF 文件解析 (使用 MNE-Python)
- `file_manager.py` - 文件管理
- `signal_calculator.py` - 信号计算引擎 (表达式求值、数据处理)
- `analysis_service.py` - 分析服务 (时域/频域/综合分析)
- `mode_service.py` - 模式管理服务 (模式存储、兼容性检查、推荐系统)
- `preprocessing.py` - 信号预处理 (去漂移、高通滤波、基线校正)
- `auto_preprocess.py` - 自动预处理流水线 (重参考、Notch滤波、伪迹检测)
- `band_analyzer.py` - 频段分析器 (频段分解、特征提取)
- `anomaly_detector.py` - 异常检测器 (棘波/尖波等异常波形检测)
- `annotation_service.py` - 标注服务 (统一标注格式转换、缓存管理)

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
     Body: {file_id: string, start: number, duration: number, channels: string[], preprocess?: PreprocessConfig}
     Response: {channelName: {min, max, mean, std, rms, peakToPeak, kurtosis, skewness, nSamples}}

POST /api/analysis/band-power         # 频带功率分析
     Body: {file_id: string, start: number, duration: number, channels: string[], bands?: Record<string, [number, number]>, preprocess?: PreprocessConfig}
     Response: {channelName: {delta, theta, alpha, beta, gamma: {absolute, relative}}}

POST /api/analysis/psd                # 功率谱密度分析
     Body: {file_id: string, start: number, duration: number, channels: string[], fmin?: number, fmax?: number, preprocess?: PreprocessConfig}
     Response: {channelName: {frequencies: number[], psd: number[]}}

POST /api/analysis/comprehensive      # 综合分析
     Body: {file_id: string, start: number, duration: number, channels: string[], fmin?: number, fmax?: number, bands?: Record<string, [number, number]>, preprocess?: PreprocessConfig}
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

# 频段分析端点
POST /api/band_analysis/{file_id}     # 频段波形识别分析
     Body: {start, duration, channels?, epoch_duration?, include_gamma?}

# 异常检测端点
POST /api/anomaly_detection/{file_id} # 异常波形检测
     Body: {start, duration, channels?, sensitivity?, run_preprocess?}

# 标注系统端点
POST /api/annotations/{file_id}/generate  # 触发完整分析生成标注
GET  /api/annotations/{file_id}           # 获取标注 (支持时间/类型/通道过滤)
POST /api/annotations/{file_id}/user      # 添加用户手动标注
DELETE /api/annotations/{file_id}/user/{id}  # 删除用户标注
DELETE /api/annotations/{file_id}/cache   # 清除文件标注缓存
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

**高级分析独立页面** (`frontend/src/pages/AdvancedAnalysisPage.tsx`):
- 在新窗口中打开的独立页面，用于原始信号和预处理后信号的对比分析
- 通过 URL 参数接收配置：`fileId`, `selectionStart`, `selectionEnd`, `channels`, `analysisType`, `preprocessMethod`
- 支持两种视图：波形对比 (SignalComparisonView) 和统计对比 (StatsView/FrequencyView)
- 预处理参数可通过滑块实时调整，自动重新计算分析结果

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

### 5. 标注系统 (Annotation System)

将伪迹检测、频段分析、异常检测的结果统一转换为标准化的 Annotation 格式。

**标注类型**:
- 伪迹标注: EOG 眼电、EMG 肌电、平坦信号、信号漂移、信号跳变
- 频段标注: 优势频段
- 异常标注: 棘波、尖波、棘慢复合波、慢波异常、节律异常

**标注生成流程**: `POST /api/annotations/{file_id}/generate` → 预处理流水线 → 伪迹检测 → 频段分析 → 异常检测 → 统一 Annotation 格式

**前端组件**: `AnnotationLayer.tsx` (波形上的标注叠加层), `AnnotationPanel.tsx` (标注列表面板)

**关键实现**: 标注生成使用 `ProcessPoolExecutor` 避免 GIL 阻塞 uvicorn 事件循环

### 6. 内存优化 (关键)

176MB EDF 文件完整加载需要 ~240MB RAM。优化方案：
```python
raw = mne.io.read_raw_edf(file_path, preload=False, encoding='latin1')
raw.crop(tmin=start_time, tmax=end_time)  # 只加载时间段
raw.pick_channels(selected_channels)      # 只选择通道
raw.load_data()                           # 现在才加载
```

### 7. 中文文件名支持

必须使用 `encoding='latin1'` 参数读取 EDF 文件。前端 UTF-8 无需特殊处理。

### 8. Canvas 渲染

`WaveformCanvas.tsx` 使用原生 Canvas API。注意坐标系统对齐 (X 轴宽度必须与 TimeAxis 一致)。

### 9. 测试覆盖率

**前端 (Vitest)**:
- 测试框架: Vitest + Testing Library (jsdom, v8 coverage)
- 覆盖率要求: 80%

**后端 (Pytest)**:
- 测试框架: Pytest + httpx (使用 `TestClient`)
- 测试夹具: `client` (FastAPI TestClient), `sample_metadata`
- 覆盖率要求: 80%
- 异步模式: asyncio: auto
- 自定义标记: `@pytest.mark.visualize` (需要 matplotlib)

**测试文件结构**:
```
frontend/src/
├── api/__tests__/          # API 调用层测试 (edf, mode, annotations)
├── components/__tests__/   # 组件测试 (含坐标系统验证)
├── store/__tests__/        # Zustand store 测试
├── types/__tests__/        # 类型测试 (mode, annotation)
└── utils/__tests__/        # 工具函数测试

backend/tests/
├── conftest.py             # 测试夹具 (client, sample_metadata)
├── test_health.py          # 健康检查
├── test_signals_api.py     # 信号 API
├── test_signal_calculator.py # 信号计算
├── test_analysis_api.py    # 分析 API
├── test_analysis_service.py # 分析服务
├── test_modes_api.py       # 模式管理 API
├── test_band_analyzer.py   # 频段分析器
├── test_band_analysis_integration.py
├── test_anomaly_detector.py # 异常检测
├── test_anomaly_integration.py
├── test_annotation_service.py # 标注服务
├── test_auto_preprocess.py # 自动预处理
├── test_preprocessing.py   # 预处理方法
├── test_demo_endpoint.py   # Demo 端点
└── test_async_blocking_fix.py # 异步阻塞修复验证
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
- `@tanstack/react-query@^5.90.20` - 数据获取/缓存，用于 API 请求状态管理
- `uplot@^1.6.32` - 高性能图表库，用于大数据量可视化

## 文件结构

```
edf-web/
├── frontend/                    # React 前端
│   ├── src/
│   │   ├── App.tsx             # 主应用容器
│   │   ├── env.ts              # 环境变量 (API URL)
│   │   ├── api/                # API 客户端 (edf.ts, mode.ts, annotations.ts)
│   │   ├── store/edfStore.ts   # Zustand 全局状态
│   │   ├── utils/              # 工具函数 (表达式解析、统计、模式兼容性)
│   │   ├── types/              # 类型定义 (signal, analysis, mode, annotation)
│   │   ├── pages/              # 独立页面
│   │   │   └── AdvancedAnalysisPage.tsx  # 高级分析独立页面
│   │   └── components/         # React 组件 (约 27 个)
│   │       ├── WaveformCanvas.tsx      # 波形画布
│   │       ├── AnnotationLayer.tsx     # 标注叠加层
│   │       ├── AnnotationPanel.tsx     # 标注面板
│   │       └── advanced-analysis/      # 高级分析子组件
│   │           └── SignalComparisonView.tsx  # 信号对比视图
│   ├── package.json
│   └── vite.config.ts          # 含 Vite proxy (→ localhost:8000)
│
├── backend/                     # FastAPI 后端
│   ├── app/
│   │   ├── main.py             # 应用入口、路由注册、CORS 配置
│   │   ├── config.py           # 配置管理
│   │   ├── models/mode.py      # Pydantic 模型
│   │   ├── api/routes/         # API 路由 (11 个)
│   │   ├── services/           # 业务逻辑 (10 个服务)
│   │   └── utils/expression_validator.py
│   ├── tests/                  # 后端测试 (~20 个文件)
│   ├── storage/                # 文件存储 (EDF + 模式数据)
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

**前端**: 检查 Zustand store 状态、localStorage 中的信号数据
**后端**: `logging.basicConfig(level=logging.DEBUG)` 启用详细日志
**API 文档**: http://localhost:8000/docs (Swagger UI)

## 常见问题

| 问题 | 解决方案 |
|------|--------|
| 表达式验证失败 | 检查通道名称、括号平衡 |
| 信号不显示 | 检查浏览器控制台、API 响应 |
| 文件未找到 | 检查 storage 目录 |
| 内存不足 | 使用 `preload=False` + `crop()` + `pick_channels()` |
| API 超时 | 增加超时时间或优化表达式 |
| 后端冻结 | CPU 密集任务需用 `asyncio.to_thread` 或 `ProcessPoolExecutor` |

## 安全特性

- **表达式求值**: 白名单机制，只允许 `np.abs/mean/std/min/max/sum/sqrt/log/exp`，长度 ≤ 500 字符，禁止文件 I/O 和系统命令
- **内置模式保护**: 不能通过 API 修改或删除 (HTTP 403)
- **输入验证**: 所有用户输入经过 Pydantic 验证
- **错误消息**: 不泄露敏感系统信息
