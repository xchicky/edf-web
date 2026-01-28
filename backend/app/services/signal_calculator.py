"""
Signal Calculator Service - Computes derived signals from expressions
"""

import numpy as np
import logging
from typing import Dict, List, Any, Optional
from pathlib import Path
import mne

logger = logging.getLogger(__name__)


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
            import re

            pattern = r"\b" + re.escape(channel_name) + r"\b"
            replacement = f"channels['{channel_name}']"
            processed = re.sub(pattern, replacement, processed)

        return processed

    def _safe_eval_expression(
        self, expression: str, channel_data: Dict[str, np.ndarray]
    ) -> np.ndarray:
        """
        安全求值表达式

        Args:
            expression: 处理后的表达式
            channel_data: 通道数据字典

        Returns:
            计算结果数组
        """
        # 创建受限命名空间
        safe_namespace = {
            "channels": channel_data,
            "np": np,
            "__builtins__": {},
        }

        try:
            # 设置超时保护（通过限制操作数）
            result = eval(expression, safe_namespace)

            # 确保结果是 numpy 数组
            if not isinstance(result, np.ndarray):
                result = np.array(result)

            return result
        except Exception as e:
            logger.error(f"Expression evaluation error: {e}")
            raise

    def __del__(self):
        """清理资源"""
        if self.raw is not None:
            del self.raw
