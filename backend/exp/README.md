# EEG 分析实验框架

## 概述

实验框架为 EEG 分析工具提供全面的验证和扩展能力。通过模拟各种伪迹信号、漂移信号和生理性 EEG 事件，验证分析算法的准确性和鲁棒性。

### 实验类别

1. **伪迹信号实验** - 测试分析工具对常见 EEG 伪迹的鲁棒性
2. **漂移信号实验** - 验证漂移检测和去除算法，包括 `a*sin(x) + b*x` 模式
3. **EEG 事件实验** - 验证对生理性 EEG 波形和事件的分析能力

## 安装和设置

### 依赖要求

```bash
pip install numpy scipy matplotlib mne
```

### 目录结构

```
backend/exp/
├── experiments/           # 实验模块
│   ├── experiment_artifacts.py      # 伪迹信号实验
│   ├── experiment_drift.py          # 漂移信号实验
│   ├── experiment_eeg_events.py     # EEG 事件实验
│   └── experiment_runner.py         # 统一实验运行器
├── utils/                 # 工具模块
│   ├── analysis_validator.py        # 分析验证工具
│   ├── visualization.py             # 可视化工具
│   └── metrics.py                   # 指标计算工具
└── reports/               # 实验报告
    ├── artifacts/          # 伪迹实验报告
    ├── drift/              # 漂移实验报告
    └── eeg_events/         # EEG 事件报告
```

## 快速开始

### 运行所有实验

```bash
cd backend
python -m exp.experiments.experiment_runner --mode all
```

### 运行特定实验类别

```bash
# 仅伪迹实验
python -m exp.experiments.experiment_runner --mode artifacts

# 仅漂移实验
python -m exp.experiments.experiment_runner --mode drift

# 仅 EEG 事件实验
python -m exp.experiments.experiment_runner --mode eeg_events
```

### 快速测试模式

```bash
# 使用最小测试集快速验证
python -m exp.experiments.experiment_runner --mode quick
```

### 自定义参数

```bash
# 指定采样率和报告目录
python -m exp.experiments.experiment_runner \
    --mode all \
    --sfreq 500 \
    --report-dir ./custom_reports
```

## 实验详解

### 1. 伪迹信号实验

**目的**: 验证分析工具对常见 EEG 伪迹的鲁棒性

**实验类型**:

| 实验类型 | 描述 | 关键验证 |
|---------|------|----------|
| 基线漂移 | 低频漂移 (0.1-0.5 Hz) | Delta 频带功率准确性 |
| 眼动伪迹 | 眨眼引起的瞬态偏移 | 伪迹检测、SNR |
| 工频干扰 | 50/60 Hz 电力线噪声 | 频率检测精度 |
| 肌电伪迹 | 高频 EMG 干扰 | Gamma 频带、SAR |
| 电极弹出 | 瞬态尖峰 | 伪迹检测置信度 |
| 真实 EEG | 综合伪迹场景 | 多伪迹分离 |

**使用示例**:

```python
from exp.experiments.experiment_artifacts import ArtifactExperiments

exp = ArtifactExperiments(sfreq=500.0, base_report_dir="./reports/artifacts")

# 运行基线漂移实验
results = exp.run_baseline_wander_experiment(
    amplitudes=[20, 50, 100],  # µV
    freqs=[0.1, 0.2, 0.5]      # Hz
)

# 运行完整套件
all_results = exp.run_full_suite()
```

**预期结果**:
- 伪迹检测置信度 > 0.7
- 频率检测误差 < 0.5 Hz
- SNR > 10 dB（有明显伪迹时）

### 2. 漂移信号实验

**目的**: 验证漂移检测和去除算法

**实验类型**:

| 实验类型 | 信号模型 | 关键验证 |
|---------|---------|----------|
| 线性漂移 | `signal + b*x` | 漂移范围、相关系数 |
| 正弦漂移 | `signal + a*sin(2πft)` | 频率检测、相位 |
| 组合漂移 | `signal + a*sin(x) + b*x` | **总漂移量、SNR** |
| 指数漂移 | `signal + a*exp(b*x)` | 非线性检测 |
| 多项式漂移 | `signal + Σ(aᵢ*xⁱ)` | 高阶趋势 |
| 去漂移验证 | 预处理前后对比 | **恢复精度、改善率** |

**重点: 组合漂移实验 (a*sin(x) + b*x)**

这是用户特别要求的漂移模式，实验框架专门对此进行了增强：

```python
from exp.experiments.experiment_drift import DriftExperiments

exp = DriftExperiments(sfreq=500.0, base_report_dir="./reports/drift")

# 运行组合漂移实验 (a*sin(x) + b*x)
results = exp.run_combined_drift_experiment(
    a_values=[5, 10, 50, 100],  # 正弦振幅 (µV)
    b_values=[1, 5, 20, 50],    # 线性斜率 (µV/s)
    sine_freq=0.2,               # 正弦频率 (Hz)
    base_frequency=10.0          # 基础信号频率 (Hz)
)
```

**信号公式**: `y(t) = A*sin(2πf₀t) + a*sin(2πfd*t) + b*t`

- `A*sin(2πf₀t)`: 基础 EEG 信号 (10 Hz Alpha 波)
- `a*sin(2πfd*t)`: 正弦漂移分量
- `b*t`: 线性漂移分量

**验证指标**:
- 总漂移范围: 应接近 `2a + b*duration`
- SNR: 漂移越强，SNR 越低
- Alpha 频带误差: 漂移导致的功率误差

**使用示例**:

```python
# 运行去漂移验证实验 (测试预处理效果)
results = exp.run_detrending_experiment()
```

**预期结果**:
- 去漂移后相关系数 > 0.9
- 功率误差改善 > 50%
- 线性去漂移对线性漂移最有效
- 高通滤波对正弦漂移最有效

### 3. EEG 事件实验

**目的**: 验证对生理性 EEG 波形和事件的分析能力

**实验类型**:

| 实验类型 | 描述 | 关键验证 |
|---------|------|----------|
| 睡眠纺锤波 | 11-16 Hz 短暂爆发 | Alpha 频带峰值 |
| K-复合波 | 负尖波 + 慢正波 | 瞬态检测 |
| 癫痫棘波 | 尖锐瞬态 (20-80 ms) | 伪迹检测 |
| P300 | 事件相关电位 (~300 ms) | 潜伏期检测 |
| Alpha 阻断 | 睁眼时 Alpha 抑制 | 频带功率变化 |
| 背景脑电 | 静息态 EEG | Alpha 优势 |

**使用示例**:

```python
from exp.experiments.experiment_eeg_events import EEGEventExperiments

exp = EEGEventExperiments(sfreq=500.0, base_report_dir="./reports/eeg_events")

# 运行睡眠纺锤波实验
results = exp.run_sleep_spindle_experiment(
    durations=[0.5, 1.0, 2.0],    # 秒
    center_freqs=[11, 13, 16],     # Hz
    amplitudes=[30, 50, 100]       # µV
)

# 运行背景 EEG 实验
results = exp.run_background_eeg_experiment(
    alpha_freqs=[10.0],  # Hz
    durations=[5.0]      # 秒
)
```

**预期结果**:
- 睡眠纺锤波应显示在 Alpha 频带
- 背景 EEG 应显示 Alpha 优势 (> 50% 相对功率)
- P300 潜伏期应在 250-350 ms 范围

## 结果解释

### 报告结构

每个实验生成两类报告:

1. **JSON 结果文件** (`experiment_results.json`)
   ```json
   {
     "experiment_name": "baseline_wander_experiment",
     "timestamp": "2025-01-15T10:30:00",
     "results": [
       {
         "test_case": "amplitude=20µV, freq=0.1Hz",
         "passed": true,
         "metrics": {
           "snr_db": 23.5,
           "band_powers": {...},
           "detection_confidence": 0.95
         }
       }
     ],
     "summary": {
       "total_tests": 12,
       "passed_tests": 11,
       "pass_rate": 0.917
     }
   }
   ```

2. **可视化文件** (`comparison_plot.png`)
   - 时域对比: 原始信号 vs 含伪迹信号
   - 频域对比: 功率谱密度
   - 伪迹/漂移分量可视化

3. **Markdown 摘要** (`SUMMARY.md`)
   - 人类可读的实验总结
   - 通过/失败的测试列表
   - 关键指标汇总

### 指标说明

| 指标 | 说明 | 良好值 |
|------|------|--------|
| SNR (信噪比) | 信号质量 | > 20 dB |
| SAR (信号伪迹比) | 伪迹抑制 | > 10 dB |
| 频率检测误差 | 频率识别精度 | < 0.5 Hz |
| 频带功率误差 | 功率谱准确性 | < 20% |
| 相关系数 | 信号相似度 | > 0.9 |
| 检测置信度 | 伪迹/事件检测 | > 0.7 |

### 通过/失败标准

实验通过标准:

- **单个测试**: 所有验证指标满足容差要求
- **实验套件**: 通过率 ≥ 80%
- **完全通过**: 通过率 = 100%
- **部分通过**: 通过率 50-80%
- **失败**: 通过率 < 50%

## 配置选项

### 全局配置

```python
from exp.experiments.experiment_runner import ExperimentRunner

runner = ExperimentRunner(
    base_report_dir="./reports",  # 报告输出目录
    sfreq=500.0                   # 采样率 (Hz)
)
```

### 采样率选择

| 采样率 | 适用场景 | 注意事项 |
|--------|---------|----------|
| 250 Hz | 基础 EEG，临床用途 | Gamma 频带受限 |
| 500 Hz | 标准设置，推荐 | 覆盖所有 EEG 频带 |
| 1000 Hz | 高频分析，研究用途 | 更大计算量 |

### 频带定义

```python
BANDS = {
    "delta": (0.5, 4),    # 深度睡眠
    "theta": (4, 8),      # 浅睡眠/冥想
    "alpha": (8, 13),     # 警觉 relaxed
    "beta": (13, 30),     # 活跃思考
    "gamma": (30, 50)     # 认知处理
}
```

## 扩展实验

### 添加新实验类型

1. **创建实验类**:

```python
# exp/experiments/experiment_custom.py
from exp.experiments.experiment_artifacts import ArtifactExperiments

class CustomExperiments(ArtifactExperiments):
    def run_my_custom_experiment(self, params):
        """自定义实验"""
        # 1. 生成测试信号
        signals = self._generate_test_signals(params)

        # 2. 运行分析
        results = []
        for signal in signals:
            analysis = self._analyze_signal(signal)
            validation = self.validator.validate_XXX(...)
            results.append(validation)

        # 3. 生成报告
        self._save_results("my_custom_experiment", results)
        return {"results": results, ...}

    def _generate_test_signals(self, params):
        """信号生成逻辑"""
        ...

    def _analyze_signal(self, signal):
        """分析逻辑"""
        ...
```

2. **集成到运行器**:

编辑 `exp/experiments/experiment_runner.py`:

```python
from exp.experiments.experiment_custom import CustomExperiments

class ExperimentRunner:
    def __init__(self, ...):
        ...
        self.custom_experiments = CustomExperiments(sfreq, ...)

    def run_custom_experiments(self, quick_mode=False):
        return self.custom_experiments.run_full_suite()
```

3. **添加命令行选项**:

```python
def main():
    parser.add_argument(
        "--mode",
        choices=["all", "artifacts", "drift", "eeg_events", "custom", "quick"],
        ...
    )
```

### 添加新验证方法

编辑 `exp/utils/analysis_validator.py`:

```python
class AnalysisValidator:
    def validate_my_metric(self, expected, actual, tolerance=0.1):
        """自定义验证方法"""
        error = abs(expected - actual)
        passed = error <= tolerance

        return ValidationResult(
            passed=passed,
            metric_name="my_metric",
            expected=expected,
            actual=actual,
            tolerance=tolerance,
            error=error,
            message=f"误差 {error:.3f}, 容差 {tolerance}"
        )
```

### 自定义可视化

编辑 `exp/utils/visualization.py`:

```python
def plot_my_custom_visualization(data, save_path):
    """自定义可视化"""
    fig, axes = plt.subplots(2, 2, figsize=(12, 8))

    # 子图 1
    axes[0, 0].plot(data['time'], data['signal'])
    axes[0, 0].set_title('自定义信号')

    # ... 更多子图

    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close()
```

## 最佳实践

### 实验设计

1. **控制变量**: 每次实验只改变一个参数
2. **参数范围**: 覆盖实际使用场景
   - 伪迹振幅: 10-200 µV
   - 频率范围: 0.1-100 Hz
   - 漂移斜率: 1-100 µV/s

3. **测试数量**: 平衡覆盖度和运行时间
   - 快速测试: 每个实验 2-4 个测试用例
   - 完整测试: 每个实验 10-20 个测试用例

### 验证标准

1. **容差设置**: 基于实际应用需求
   - 频率检测: ±0.5 Hz
   - 功率误差: ±20%
   - 相关系数: > 0.9

2. **多指标验证**: 不要依赖单一指标
   - 时域 + 频域
   - 客观指标 + 主观可视化

### 报告管理

1. **定期清理**: 删除过期的实验报告
2. **版本控制**: 记录关键实验结果
3. **对比分析**: 保存基线结果用于回归测试

## 故障排除

### 常见问题

**Q: 实验运行失败，提示缺少模块**
```bash
# 解决方案: 安装缺失的依赖
pip install numpy scipy matplotlib mne
```

**Q: 可视化图表无法生成**
```bash
# 解决方案: 配置 matplotlib 后端
export MPLBACKEND=Agg  # 无 GUI 环境
```

**Q: 内存不足**
```python
# 解决方案: 减少信号长度或采样率
exp = ArtifactExperiments(sfreq=250.0)  # 降低采样率
```

**Q: 实验通过率低**
- 检查验证标准是否过于严格
- 查看可视化结果，判断是否为假阳性
- 调整容差参数

### 调试技巧

1. **启用详细日志**:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

2. **单个实验测试**:
```python
# 运行特定实验
results = exp.run_baseline_wander_experiment(
    amplitudes=[20],  # 只测试一个值
    freqs=[0.1]
)
```

3. **检查中间结果**:
```python
# 在实验方法中添加打印
print(f"Generated signal shape: {signal.shape}")
print(f"Analysis result: {analysis}")
```

## 参考文献

1. **EEG 伪迹**:
   - Ille, N. et al. (2002). Artifact reduction in EEG.

2. **漂移去除**:
   - Nolan, H. et al. (2010). BABYEEG: Automatic artifact removal.

3. **EEG 事件**:
   - Niedermeyer, E. & Silva, F. L. (2005). Electroencephalography.

4. **频带功率**:
   - Klimesch, W. (1999). EEG alpha and theta oscillations.

## 贡献指南

欢迎贡献新的实验类型和验证方法！

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/new-experiment`)
3. 提交更改 (`git commit -m 'Add new experiment'`)
4. 推送到分支 (`git push origin feature/new-experiment`)
5. 创建 Pull Request

### 代码规范

- 遵循 PEP 8 风格指南
- 添加完整的文档字符串
- 确保测试覆盖率 > 80%
- 更新相关文档

## 许可证

与主项目保持一致。

## 联系方式

如有问题或建议，请通过 GitHub Issues 联系。
