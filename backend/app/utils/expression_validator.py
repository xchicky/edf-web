"""
Expression Validator - Backend expression validation utility
"""

import re
from typing import Dict, List, Any, Set


def validate_expression(expression: str, channel_names: List[str]) -> Dict[str, Any]:
    """
    验证表达式

    Args:
        expression: 表达式字符串
        channel_names: 可用的通道名称列表

    Returns:
        验证结果字典
    """
    try:
        # 检查表达式是否为空
        if not expression or not expression.strip():
            return {
                "isValid": False,
                "error": "表达式不能为空",
            }

        # 检查表达式长度
        if len(expression) > 500:
            return {
                "isValid": False,
                "error": "表达式过长（最多 500 字符）",
            }

        # 创建可用通道集合
        available_channels = set(channel_names)

        # 提取通道引用
        referenced_channels = _extract_channels(expression, available_channels)

        # 提取常数
        constants = _extract_constants(expression)

        # 验证括号平衡
        if not _check_balanced_parentheses(expression):
            return {
                "isValid": False,
                "error": "括号不平衡",
            }

        # 验证操作符序列
        if not _check_valid_operators(expression):
            return {
                "isValid": False,
                "error": "无效的操作符序列",
            }

        # 验证表达式完整性
        if not _check_expression_complete(expression):
            return {
                "isValid": False,
                "error": "表达式不完整",
            }

        return {
            "isValid": True,
            "referencedChannels": sorted(list(referenced_channels)),
            "constants": sorted(list(constants)),
        }

    except Exception as e:
        return {
            "isValid": False,
            "error": f"验证错误: {str(e)}",
        }


def _extract_channels(expression: str, available_channels: Set[str]) -> Set[str]:
    """提取表达式中的通道引用"""
    referenced = set()

    # 按长度降序排序，避免部分匹配
    sorted_channels = sorted(available_channels, key=len, reverse=True)

    for channel in sorted_channels:
        # 使用单词边界匹配
        pattern = r"\b" + re.escape(channel) + r"\b"
        if re.search(pattern, expression):
            referenced.add(channel)

    # 检查是否有未知的标识符
    # 移除所有已知的通道、操作符、括号、数字和空格
    temp = expression
    for channel in sorted_channels:
        pattern = r"\b" + re.escape(channel) + r"\b"
        temp = re.sub(pattern, "", temp)

    # 移除操作符、括号、数字、小数点和空格
    temp = re.sub(r"[\+\-\*/\(\)\s\d\.]", "", temp)

    if temp:
        # 还有未识别的字符
        raise ValueError(f"未知的标识符或字符: {temp}")

    return referenced


def _extract_constants(expression: str) -> Set[float]:
    """提取表达式中的常数"""
    constants = set()

    # 匹配整数和浮点数
    pattern = r"-?\d+\.?\d*"
    matches = re.findall(pattern, expression)

    for match in matches:
        if match and match != "-":  # 排除单独的负号
            try:
                constants.add(float(match))
            except ValueError:
                pass

    return constants


def _check_balanced_parentheses(expression: str) -> bool:
    """检查括号是否平衡"""
    count = 0
    for char in expression:
        if char == "(":
            count += 1
        elif char == ")":
            count -= 1
        if count < 0:
            return False
    return count == 0


def _check_valid_operators(expression: str) -> bool:
    """检查操作符序列是否有效"""
    # 移除空格
    expr = expression.replace(" ", "")

    # 检查连续的操作符（除了一元操作符）
    # 允许的模式：
    # - 操作符后跟 ( 或数字或通道名
    # - 操作符后跟 - 或 + （一元）
    # - 操作符后跟 ) 是错误的

    # 简单检查：不允许 ++ -- */ 等
    invalid_patterns = [r"\+\+", r"--", r"\*\*", r"//", r"\*/", r"/\*"]
    for pattern in invalid_patterns:
        if re.search(pattern, expr):
            return False

    # 检查是否以操作符结尾（除了 ）
    if re.search(r"[\+\-\*/]\s*$", expr):
        return False

    return True


def _check_expression_complete(expression: str) -> bool:
    """检查表达式是否完整"""
    # 移除空格
    expr = expression.replace(" ", "")

    # 表达式不能为空
    if not expr:
        return False

    # 表达式不能以操作符开头（除了 - 和 +）
    if expr[0] in ["*", "/"]:
        return False

    # 表达式不能以 ( 结尾
    if expr[-1] == "(":
        return False

    return True
