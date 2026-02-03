"""
Signal Calculator Service - Computes derived signals from expressions
"""

import numpy as np
import logging
import re
from typing import Dict, List, Any, Optional, Set
from pathlib import Path
import mne

logger = logging.getLogger(__name__)

# 允许的 NumPy 函数白名单（安全子集）
ALLOWED_NUMPY_FUNCTIONS: Set[str] = {
    # 基本数学函数
    "abs", "absolute", "sqrt", "square", "exp", "exp2", "expm1",
    "log", "log2", "log10", "log1p", "logaddexp", "logaddexp2",
    "sin", "cos", "tan", "arcsin", "arccos", "arctan", "arctan2",
    "sinh", "cosh", "tanh", "arcsinh", "arccosh", "arctanh",
    "deg2rad", "rad2deg", "degrees", "radians",
    # 统计函数
    "mean", "median", "std", "var", "min", "max", "argmin", "argmax",
    "ptp", "average", "sum", "prod", "cumsum", "cumprod",
    "percentile", "quantile",
    # 舍入函数
    "round", "floor", "ceil", "trunc", "fix",
    # 其他安全函数
    "clip", "conj", "conjugate", "real", "imag", "angle",
    "fabs", "fmod", "mod", "modf", "remainder", "divmod",
    "positive", "negative", "reciprocal", "power",
    # 常量
    "pi", "e", "inf", "nan", "infinity",
}

# 表达式最大长度限制
MAX_EXPRESSION_LENGTH = 500

# 表达式求值超时时间（秒）
EVALUATION_TIMEOUT = 5


class SignalCalculator:
    """计算派生信号的服务"""

    def __init__(self, file_path: str):
        """
        初始化信号计算器

        Args:
            file_path: EDF 文件路径
        """
        self.file_path = Path(file_path)
        self.raw: Optional[mne.io.Raw] = None
        self._load_edf()

    def _load_edf(self) -> None:
        """加载 EDF 文件"""
        try:
            logger.info(f"Loading EDF file for signal calculation: {self.file_path}")
            self.raw = mne.io.read_raw_edf(
                str(self.file_path),
                preload=False,
                encoding="latin1",
                verbose=False,
            )
            logger.info(f"EDF loaded: {len(self.raw.ch_names)} channels")
        except Exception as e:
            logger.error(f"Failed to load EDF file: {e}")
            raise

    def calculate_signals(
        self,
        signals: List[Dict[str, Any]],
        start_time: float,
        duration: float,
    ) -> List[Dict[str, Any]]:
        """
        计算多个派生信号

        Args:
            signals: 信号定义列表，每个包含 id、expression、operands
            start_time: 开始时间（秒）
            duration: 持续时间（秒）

        Returns:
            计算结果列表
        """
        if self.raw is None:
            raise ValueError("EDF file not loaded")

        results = []

        for signal_def in signals:
            try:
                result = self._calculate_single_signal(
                    signal_def, start_time, duration
                )
                results.append(result)
            except Exception as e:
                logger.error(
                    f"Failed to calculate signal {signal_def.get('id')}: {e}"
                )
                raise

        return results

    def _calculate_single_signal(
        self,
        signal_def: Dict[str, Any],
        start_time: float,
        duration: float,
    ) -> Dict[str, Any]:
        """
        计算单个派生信号

        Args:
            signal_def: 信号定义 {id, name, expression, operands}
            start_time: 开始时间
            duration: 持续时间

        Returns:
            计算结果 {id, name, data, times, sfreq, n_samples}
        """
        signal_id = signal_def["id"]
        signal_name = signal_def["name"]
        expression = signal_def["expression"]
        operands = signal_def["operands"]

        logger.info(f"Calculating signal {signal_id}: {expression}")

        # 验证操作数
        self._validate_operands(operands)

        # 验证表达式安全性
        self._validate_expression(expression, operands)

        # 加载所需的通道数据
        channel_data = self._load_channel_data(operands, start_time, duration)

        # 预处理表达式
        processed_expr = self._preprocess_expression(expression, operands)

        # 安全求值表达式
        try:
            result_data = self._safe_eval_expression(processed_expr, channel_data)
        except Exception as e:
            logger.error(f"Expression evaluation failed: {e}")
            raise ValueError(f"表达式求值失败: {str(e)}")

        # 获取时间数组
        sfreq = self.raw.info["sfreq"]
        start_sample = int(start_time * sfreq)
        stop_sample = int((start_time + duration) * sfreq)
        times = np.arange(start_sample, stop_sample) / sfreq

        return {
            "id": signal_id,
            "name": signal_name,
            "data": result_data.tolist(),
            "times": times.tolist(),
            "sfreq": float(sfreq),
            "n_samples": len(result_data),
        }

    def _validate_operands(self, operands: List[Dict[str, Any]]) -> None:
        """验证操作数"""
        if not self.raw:
            raise ValueError("EDF file not loaded")

        for operand in operands:
            channel_index = operand.get("channelIndex")
            channel_name = operand.get("channelName")

            if channel_index is None or channel_index < 0:
                raise ValueError(f"无效的通道索引: {channel_index}")

            if channel_index >= len(self.raw.ch_names):
                raise ValueError(
                    f"通道索引 {channel_index} 超出范围 (总共 {len(self.raw.ch_names)} 个通道)"
                )

            if self.raw.ch_names[channel_index] != channel_name:
                raise ValueError(
                    f"通道名称不匹配: 索引 {channel_index} 对应 {self.raw.ch_names[channel_index]}, 期望 {channel_name}"
                )

    def _validate_expression(self, expression: str, operands: List[Dict[str, Any]]) -> None:
        """
        验证表达式安全性

        Args:
            expression: 原始表达式
            operands: 操作数列表

        Raises:
            ValueError: 如果表达式不安全
        """
        # 检查表达式长度
        if len(expression) > MAX_EXPRESSION_LENGTH:
            raise ValueError(f"表达式过长（最多 {MAX_EXPRESSION_LENGTH} 字符）")

        if not expression.strip():
            raise ValueError("表达式不能为空")

        # 检查危险的函数调用模式
        dangerous_patterns = [
            r"\b__\w+__\b",  # 魔术方法
            r"\bimport\b",
            r"\bexec\b",
            r"\beval\b",
            r"\bopen\b",
            r"\bfile\b",
            r"\bcompile\b",
            r"\bgetattr\b",
            r"\bsetattr\b",
            r"\bdelattr\b",
            r"\bhasattr\b",
            r"\bglobals\b",
            r"\blocals\b",
            r"\bvars\b",
            r"\bdir\b",
            r"\btype\b",
            r"\b__import__\b",
            r"\bos\.",
            r"\bsys\.",
            r"\bsubprocess\.",
            r"\bpathlib\.",
        ]

        for pattern in dangerous_patterns:
            if re.search(pattern, expression):
                raise ValueError(f"表达式包含不允许的操作")

        # 检查未知标识符
        # 只允许：通道名、np.函数名、运算符、括号、数字
        allowed_channels = set(op["channelName"] for op in operands)

        # 构建允许的标识符模式
        allowed_pattern_parts = []

        # 添加通道名称（按长度降序排序以避免部分匹配）
        for ch in sorted(allowed_channels, key=len, reverse=True):
            allowed_pattern_parts.append(r"\b" + re.escape(ch) + r"\b")

        # 添加 np.函数名
        for func in ALLOWED_NUMPY_FUNCTIONS:
            allowed_pattern_parts.append(r"\bnp\." + re.escape(func) + r"\b")

        # 移除所有允许的内容
        temp = expression
        for pattern in allowed_pattern_parts:
            temp = re.sub(pattern, "", temp)

        # 移除运算符、括号、数字、小数点、空格
        temp = re.sub(r"[\+\-\*/\(\)\s\d\.]", "", temp)

        # 如果还有剩余内容，说明有未知标识符
        if temp.strip():
            raise ValueError(f"表达式包含未知的标识符或函数")

    def _create_safe_namespace(self, channel_data: Dict[str, np.ndarray]) -> Dict[str, Any]:
        """
        创建安全的求值命名空间，只包含白名单中的 NumPy 函数

        Args:
            channel_data: 通道数据字典

        Returns:
            安全的命名空间字典
        """
        safe_namespace: Dict[str, Any] = {
            "channels": channel_data,
            "__builtins__": {},
        }

        # 只添加白名单中的 NumPy 函数
        for func_name in ALLOWED_NUMPY_FUNCTIONS:
            if hasattr(np, func_name):
                obj = getattr(np, func_name)
                # 只添加函数和常量，不添加子模块
                if callable(obj) or isinstance(obj, (int, float, complex)):
                    safe_namespace[func_name] = obj

        return safe_namespace

    def _load_channel_data(
        self,
        operands: List[Dict[str, Any]],
        start_time: float,
        duration: float,
    ) -> Dict[str, np.ndarray]:
        """
        加载所需的通道数据

        Args:
            operands: 操作数列表
            start_time: 开始时间
            duration: 持续时间

        Returns:
            通道数据字典 {channel_name: data_array}
        """
        if not self.raw:
            raise ValueError("EDF file not loaded")

        # 获取所有需要的通道索引
        channel_indices = list(set(op["channelIndex"] for op in operands))
        channel_names = [self.raw.ch_names[i] for i in channel_indices]

        # 裁剪并加载数据
        raw_cropped = self.raw.copy().crop(tmin=start_time, tmax=start_time + duration)
        raw_cropped.pick_channels(channel_names)
        raw_cropped.load_data()

        # 获取数据（转换为微伏）
        data = raw_cropped.get_data(units="µV")

        # 构建通道数据字典
        channel_data = {}
        for i, channel_name in enumerate(channel_names):
            channel_data[channel_name] = data[i]

        return channel_data

    def _preprocess_expression(
        self, expression: str, operands: List[Dict[str, Any]]
    ) -> str:
        """
        预处理表达式，将通道名称替换为字典访问格式
        同时将 np. 前缀替换为直接使用函数名

        Args:
            expression: 原始表达式
            operands: 操作数列表

        Returns:
            处理后的表达式
        """
        processed = expression

        # 按长度降序排序，避免部分匹配问题
        channel_names = sorted(
            set(op["channelName"] for op in operands),
            key=len,
            reverse=True,
        )

        for channel_name in channel_names:
            # 使用正则表达式匹配完整的通道名称
            pattern = r"\b" + re.escape(channel_name) + r"\b"
            replacement = f"channels['{channel_name}']"
            processed = re.sub(pattern, replacement, processed)

        # 处理 np. 前缀 - 允许用户写 np.abs() 等，但我们会移除 np. 前缀
        # 因为在安全命名空间中，函数直接以名称提供
        processed = re.sub(r"\bnp\.", "", processed)

        return processed

    def _safe_eval_expression(
        self, expression: str, channel_data: Dict[str, np.ndarray]
    ) -> np.ndarray:
        """
        安全求值表达式（使用受限命名空间）

        安全措施：
        1. 只使用白名单中的 NumPy 函数
        2. 禁用所有内置函数
        3. 表达式长度限制（在验证阶段）
        4. 危险模式检测（在验证阶段）

        Args:
            expression: 处理后的表达式
            channel_data: 通道数据字典

        Returns:
            计算结果数组

        Raises:
            ValueError: 如果求值失败
        """
        # 创建安全的命名空间（只包含白名单函数）
        safe_namespace = self._create_safe_namespace(channel_data)

        try:
            # 求值表达式（使用空的全局和局部命名空间，只有 safe_namespace 中的内容可用）
            result = eval(expression, {"__builtins__": {}}, safe_namespace)

            # 确保结果是 numpy 数组或可转换的类型
            if not isinstance(result, (np.ndarray, (int, float, list, tuple))):
                raise ValueError(f"表达式结果类型不支持: {type(result)}")

            if not isinstance(result, np.ndarray):
                result = np.array(result)

            return result

        except Exception as e:
            logger.error(f"Expression evaluation error: {e}")
            raise ValueError(f"表达式求值失败: {str(e)}")

    def __del__(self):
        """清理资源"""
        if self.raw is not None:
            del self.raw
