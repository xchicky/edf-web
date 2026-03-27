# EDF 文件查看器 (EDF File Viewer)

用于读取和可视化 EEG/脑电图数据的 Web 应用程序
A web application for reading and visualizing EEG data from EDF files.

## 功能特性 (Features)

✅ **Web 界面** - 现代 React 前端，支持拖拽上传
✅ **后端 API** - FastAPI 服务，高效 EDF 文件解析
✅ **实时可视化** - Canvas 渲染，流畅的波形显示
✅ **时间窗口导航** - 灵活的时间轴控制
✅ **大文件支持** - 高效处理 100MB+ EDF 文件
✅ **中文文件名** - 完美支持中文文件名和元数据
✅ **Docker 支持** - 一键启动完整服务
✅ **派生信号** - 支持自定义信号表达式计算
✅ **选区分析** - 时域统计分析 (均值/标准差/RMS/峰度/偏度)
✅ **频带分析** - EEG 频带功率分析 (Delta/Theta/Alpha/Beta/Gamma)
✅ **模式管理** - 预配置分析方案 (临床/科研/教学/自定义)
✅ **智能推荐** - 基于文件特征的模式推荐系统
✅ **兼容性检查** - 自动验证模式与文件的兼容性
✅ **高测试覆盖率** - 前端 85%+，后端 80%+ 测试覆盖率  

## 快速开始 (Quick Start)

### 方式 1: Docker Compose (推荐)

```bash
# 克隆项目
git clone <repository-url>
cd edf-web

# 一键启动前后端服务
docker-compose up -d

# 访问应用
open http://localhost:5173
```

### 方式 2: 手动启动

#### 1. 启动后端 (Backend)

```bash
cd backend

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 启动 FastAPI 服务器
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 2. 启动前端 (Frontend)

```bash
cd frontend

# 安装依赖
npm install

# 启动 Vite 开发服务器
npm run dev
```

#### 3. 访问应用

打开浏览器访问: http://localhost:5173

---

## Python 命令行版本

如果您只需要命令行版本，可以使用内置的 Python 脚本：

```bash
# 安装依赖
pip install mne matplotlib
```

**依赖版本 (Required Versions)**:
- mne >= 1.0.0 (已测试: 1.11.0)
- matplotlib >= 3.5.0 (已测试: 3.10.3)
- numpy (自动安装)

### 2. 运行脚本 (Run Script)

```bash
# 方法 1: 自动检测 ./edf 目录中的文件
python edf_demo.py

# 方法 2: 指定 EDF 文件路径
python edf_demo.py /path/to/your/file.edf

# 方法 3: 使用中文文件名
python edf_demo.py ./edf/李诗敏1.edf
```

### 3. 使用交互式菜单 (Interactive Menu)

运行后，您将看到交互式菜单：

```
============================================================
  交互式菜单 (Interactive Menu)
============================================================

请选择操作 (Please select an action):
  1. 显示元数据
  2. 显示通道列表 (Show channel list)
  3. 绘制波形图 (Plot waveforms)
  4. 退出
```

## 技术细节 (Technical Details)

### 推荐库选择: MNE-Python

**为什么选择 MNE-Python？**

1. **专业性强** - 专为神经生理学数据分析设计
2. **功能完整** - 包含读取、处理、可视化、分析全套功能
3. **文档完善** - 官方文档丰富，社区活跃
4. **易于使用** - API 设计友好，学习曲线平缓

**与其他库的对比**:

| 特性 | MNE-Python | PyEDFLib | EDFlib |
|------|-----------|----------|---------|
| EDF 读取 | ✅ | ✅ | ✅ |
| 元数据提取 | ✅ 优秀 | ⚠️ 基础 | ⚠️ 基础 |
| 可视化 | ✅ 强大 | ❌ 无 | ❌ 无 |
| 大文件支持 | ✅ 优秀 | ✅ 优秀 | ✅ 优秀 |
| 中文支持 | ✅ | ✅ | ✅ |
| 分析功能 | ✅ 丰富 | ❌ 无 | ❌ 无 |
| 易用性 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |

### 内存优化架构

**问题**: 176MB EDF 文件加载到内存需要约 240MB RAM

**解决方案**:
```python
# 步骤 1: 延迟加载 (preload=False)
raw = mne.io.read_raw_edf(file, preload=False, encoding='latin1')

# 步骤 2: 只加载需要的时间段
raw.crop(tmin=0, tmax=10)  # 只加载前 10 秒
raw.load_data()            # 现在才加载到内存

# 步骤 3: 只选择需要的通道
raw.pick_channels(['EEG Fp1-Ref', 'EEG F3-Ref', ...])
```

**内存对比**:
- 完整加载: ~240 MB
- 加载 10 秒数据: ~12 MB (减少 95%)
- 加载 10 个通道 10 秒: ~2 MB (减少 99%)

### 元数据字段说明

**必显字段**:
- **文件名** - EDF 文件路径
- **通道数量** - 总通道数 (通常 20-64)
- **采样频率** - 采样率 (Hz)，通常 200-1000 Hz
- **采样点数** - 总数据点数
- **记录时长** - 秒/分钟/小时

**元数据**:
- **测量日期** - 记录时间
- **设备信息** - 设备类型/制造商
- **注释数量** - 事件标记数量

**患者信息** (如果可用):
- **ID** - 患者编号
- **性别** - 1=男性, 2=女性, 0=未知
- **年龄** - 患者年龄

### 绘图最佳实践

**推荐设置**:
```python
# 缩放因子 (Scaling)
scalings = dict(eeg=100e-6)  # 100 µV for EEG channels

# 通道数 (Number of channels)
n_channels = 10  # 一次显示 10 个通道

# 时间窗口 (Time window)
duration = 10.0  # 10 秒窗口

# 起始时间 (Start time)
start_time = 0.0  # 从 0 秒开始
```

**交互功能**:
- 🖱️ **滚轮** - 缩放时间轴
- 👆 **拖动** - 平移视图
- 💾 **按 S** - 保存图像
- ❌ **关闭窗口** - 返回菜单

## 常见问题 (FAQ)

### Q1: 中文文件名乱码怎么办？

**问题**: 文件名包含中文字符  
**解决**: 脚本已自动处理，使用 `encoding='latin1'` 参数

```python
raw = mne.io.read_raw_edf(file, encoding='latin1', preload=False)
```

### Q2: 内存不足错误？

**问题**: 文件太大，无法加载  
**解决**: 使用 `preload=False` + `crop()` 

```python
raw = mne.io.read_raw_edf(file, preload=False)
raw.crop(tmin=0, tmax=60)  # 只加载前 1 分钟
raw.load_data()
```

### Q3: 绘图窗口不显示？

**问题**: 在无 GUI 环境运行  
**解决**: 使用非交互式后端

```python
import matplotlib
matplotlib.use('Agg')  # 添加到脚本开头
```

### Q4: 如何提取原始数据？

```python
# 加载数据
raw.load_data()

# 获取所有数据 (channels × samples)
data = raw.get_data()

# 获取特定通道
data, times = raw.copy().pick(['EEG Fp1-Ref']).get_data(return_times=True)

# 保存为 CSV
import numpy as np
np.savetxt('eeg_data.csv', data.T, delimiter=',')
```

### Q5: 支持 EDF+ 格式吗？

✅ 完全支持 EDF+ 和 BDF 格式  
MNE-Python 会自动检测格式类型

## 文件结构 (File Structure)

```
edf-web/
├── backend/             # FastAPI 后端服务
│   ├── app/
│   │   ├── api/        # API 路由
│   │   │   ├── upload.py
│   │   │   ├── metadata.py
│   │   │   └── waveform.py
│   │   ├── services/   # 业务逻辑
│   │   │   ├── edf_parser.py
│   │   │   └── file_manager.py
│   │   └── main.py    # FastAPI 应用入口
│   ├── storage/        # EDF 文件存储
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/            # React 前端应用
│   ├── src/
│   │   ├── api/       # API 客户端
│   │   ├── store/     # Zustand 状态管理
│   │   ├── App.tsx    # 主应用组件
│   │   └── App.css    # 样式文件
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml  # Docker 编排配置
├── edf_demo.py         # Python 命令行版本
└── README.md           # 本文档
```

## API 端点 (API Endpoints)

### 后端 API (http://localhost:8000)

| 端点 | 方法 | 描述 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/api/upload/` | POST | 上传 EDF 文件 |
| `/api/metadata/{file_id}` | GET | 获取文件元数据 |
| `/api/waveform/{file_id}` | GET | 获取波形数据 |
| `/api/signals/validate` | POST | 验证信号表达式 |
| `/api/signals/calculate` | POST | 计算派生信号 |
| `/api/analysis/time-domain` | POST | 时域分析 |
| `/api/analysis/band-power` | POST | 频带功率分析 |
| `/api/analysis/comprehensive` | POST | 综合分析 |
| `/api/modes/` | GET | 获取所有模式 |
| `/api/modes/` | POST | 创建新模式 |
| `/api/modes/{id}` | GET | 获取模式详情 |
| `/api/modes/{id}` | PUT | 更新模式 |
| `/api/modes/{id}` | DELETE | 删除模式 |
| `/api/modes/check-compatibility` | POST | 检查模式兼容性 |
| `/api/modes/recommend` | POST | 获取推荐模式 |
| `/api/modes/{id}/export` | GET | 导出模式 (JSON) |
| `/api/modes/import` | POST | 导入模式 |

**请求示例**:

```bash
# 上传文件
curl -X POST "http://localhost:8000/api/upload/" \
  -F "file=@/path/to/file.edf"

# 获取元数据
curl "http://localhost:8000/api/metadata/{file_id}"

# 获取波形数据 (5秒窗口，从前10秒开始)
curl "http://localhost:8000/api/waveform/{file_id}?start=10&duration=5"
```

**交互式 API 文档**: http://localhost:8000/docs

## 测试 (Testing)

### 前端测试

```bash
cd frontend

# 运行所有测试
npm run test

# 生成覆盖率报告
npm run test:coverage

# 监视模式 (开发时使用)
npm run test -- --watch
```

**测试覆盖率**:
- 测试文件: 13 个
- 测试用例: 301 个
- 语句覆盖率: 84.77%
- 分支覆盖率: 75.69%
- 函数覆盖率: 85.25%
- 行覆盖率: 85.87%

### 后端测试

```bash
cd backend

# 运行所有测试
pytest

# 生成覆盖率报告
pytest --cov=app

# 详细输出
pytest -v
```

**测试覆盖率要求**: 80%+

## 示例输出 (Example Output)

```
============================================================
  文件信息 (File Information)
============================================================

文件名 (Filename): ./edf/李诗敏1.edf
通道数量 (Number of channels): 59
采样频率 (Sampling frequency): 500.0 Hz
采样点数 (Number of samples): 1,069,000
记录时长: 2138.00 秒 (seconds)
                 = 35.63 分钟 (minutes)

内存估算 (Memory estimate): ~240.6 MB (如果加载到内存)

============================================================
  元数据 (Metadata)
============================================================

测量日期: 2023-10-24 16:28:06+00:00
注释数量: 63

受试者信息:
  ID: X
  性别: 未知

============================================================
  通道列表 (Channel List)
============================================================

EEG (59 channels):
   1. EEG Fp1-Ref
   2. EEG F3-Ref
   3. EEG C3-Ref
   ...
```

## 性能基准 (Performance Benchmarks)

测试文件: 李诗敏1.edf (122 MB, 59 通道, 2138 秒)

| 操作 | 时间 | 内存 |
|------|------|------|
| 读取头部 (preload=False) | ~1 秒 | ~1 MB |
| 加载全部数据 | ~8 秒 | ~240 MB |
| 加载 10 秒数据 | ~0.5 秒 | ~12 MB |
| 绘制 10 通道 10 秒 | ~2 秒 | ~2 MB |
| 保存图像 (PNG) | ~1 秒 | - |

**建议**: 对于大文件，始终先使用 `preload=False` 查看元数据，然后只加载需要的部分。

## 扩展功能 (Advanced Features)

### 导出数据为 CSV

```python
import pandas as pd
import mne

raw = mne.io.read_raw_edf('file.edf', preload=True, encoding='latin1')
data = raw.get_data().T  # 转置为 samples × channels
df = pd.DataFrame(data, columns=raw.ch_names)
df.to_csv('eeg_export.csv', index=False)
```

### 频谱分析

```python
import mne

raw = mne.io.read_raw_edf('file.edf', preload=True, encoding='latin1')

# 计算功率谱密度
psd, freqs = raw.compute_psd(fmax=100).get_data(return_freqs=True)

# 绘制频谱图
raw.plot_psd(fmax=100)
```

### 滤波处理

```python
# 带通滤波 1-50 Hz
raw_filtered = raw.copy().filter(l_freq=1, h_freq=50)

# 去除 50 Hz 工频干扰
raw_notch = raw.copy().notch_filter(freqs=50)
```

## 相关资源 (Resources)

- **MNE-Python 官方文档**: https://mne.tools/
- **EDF 格式规范**: https://www.edfplus.info/
- **EEG 数据分析教程**: https://mne.tools/stable/auto_tutorials/index.html

## 许可证 (License)

MIT License

## 作者 (Author)

Demo Script - 2026

## 更新日志 (Changelog)

### v2.3.0 (2026-03-27) - 自动预处理流水线 + 基础设施
- ✅ EEG 自动预处理流水线 (重参考/Notch/带通滤波/伪迹检测)
- ✅ 伪迹检测 (EOG/EMG/平坦/漂移/线缆伪影)
- ✅ GitHub Actions CI 配置
- ✅ 开发环境自动加载 demo.edf
- ✅ Vite dev server 0.0.0.0 监听 + allowedHosts 配置
- ✅ 31 个预处理测试 + 可视化对比图输出

### v2.2.0 (2026-02-03) - 模式管理系统
- ✅ 模式管理功能 (CRUD 操作)
- ✅ 兼容性检查系统 (通道、采样率验证)
- ✅ 智能推荐算法 (基于文件特征和使用历史)
- ✅ 模式导入导出 (JSON 格式)
- ✅ 3 个内置模式 (临床标准/频谱研究/基础教学)
- ✅ 使用统计追踪 (使用频率、最近使用)
- ✅ 集成 SignalExpressionBuilder 到模式编辑器
- ✅ 安全强化 (表达式验证、eval() 安全)
- ✅ 73+ 后端测试，50+ 前端测试
- ✅ 完整的类型定义 (Pydantic + TypeScript)

### v2.1.0 (2026-02-01) - 测试补全 + 数据分析
- ✅ 测试覆盖率大幅提升 (前端 85%+, 后端 80%+)
- ✅ 新增 301 个单元测试 (TDD 方法论)
- ✅ 派生信号系统 (表达式计算)
- ✅ 时域统计分析 (选区分析)
- ✅ 频带功率分析 (EEG 频带)
- ✅ 功率谱密度分析 (PSD)
- ✅ 选区统计信息 (最小/最大/平均/范围)
- ✅ 完整的 API 测试覆盖

### v2.0.0 (2026-01-23) - Web 应用版本
- ✅ 完整的 Web 应用 (React + FastAPI)
- ✅ 拖拽上传 EDF 文件
- ✅ 实时波形可视化
- ✅ 时间窗口导航
- ✅ Docker Compose 一键启动
- ✅ API 文档 (FastAPI auto-docs)

### v1.0.0 (2026-01-23) - 命令行版本
- ✅ Python 命令行脚本
- ✅ 支持 EDF/EDF+ 文件读取
- ✅ 元数据提取和显示
- ✅ 多通道 EEG 可视化
- ✅ 中文文件名支持
- ✅ 交互式菜单界面

## 技术栈 (Tech Stack)

### 后端
- **FastAPI 0.104.1** - 现代高性能 Web 框架
- **MNE-Python 1.5.1** - EDF 文件解析
- **Python 3.11** - 编程语言
- **Uvicorn** - ASGI 服务器

### 前端
- **React 19.2.0** - UI 框架
- **TypeScript 5.9.3** - 类型安全
- **Vite 7.2.4** - 构建工具
- **Zustand 5.0.10** - 状态管理
- **Axios 1.13.2** - HTTP 客户端
- **React Dropzone 14.3.8** - 文件上传
- **Vitest** - 单元测试框架
- **Testing Library** - React 组件测试

### 容器化
- **Docker** - 容器技术
- **Docker Compose** - 服务编排

## 已知问题 (Known Issues)

### 依赖版本兼容性

**重要**: 请使用以下特定版本以避免兼容性问题：

```python
# backend/requirements.txt
mne==1.5.1              # NOT 1.6.0
numpy==1.26.4           # NOT 2.x
scipy==1.17.0
```

**原因**:
- MNE 1.6.0 与 scipy 1.17.0 存在兼容性问题
- NumPy 2.x 移除了 `numpy.in1d()` 函数，MNE 1.5.1 依赖此函数

### 中文文件名

如果遇到中文文件名问题，请确保：
1. 后端使用 `encoding='latin1'` 参数读取 EDF 文件
2. 前端正确处理 UTF-8 编码

## 贡献指南 (Contributing)

欢迎贡献！请遵循以下步骤：

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

---

**有问题？(Questions?)**

请检查常见问题部分或查阅 MNE-Python 官方文档。

## Author

Kami

修改时间：2026年3月27日
