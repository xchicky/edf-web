/**
 * 简化的表达式解析器
 * 用于解析、验证和提取信号表达式中的通道引用
 */

import type { SignalValidation, OperandDefinition } from '../types/signal';

/**
 * 表达式验证器 - 使用正则表达式和简单的语法检查
 */
export class ExpressionValidator {
  private expression: string;
  private availableChannels: Set<string>;

  constructor(expression: string, availableChannels: string[]) {
    this.expression = expression.trim();
    this.availableChannels = new Set(availableChannels);
  }

  validate(): SignalValidation {
    try {
      // 检查表达式是否为空
      if (!this.expression) {
        return {
          isValid: false,
          error: '表达式不能为空',
        };
      }

      // 检查表达式长度
      if (this.expression.length > 500) {
        return {
          isValid: false,
          error: '表达式过长（最多 500 字符）',
        };
      }

      // 检查括号平衡
      if (!this.checkBalancedParentheses()) {
        return {
          isValid: false,
          error: '括号不平衡',
        };
      }

      // 提取通道引用
      const referencedChannels = this.extractChannels();

      // 检查是否有未知的通道
      for (const channel of referencedChannels) {
        if (!this.availableChannels.has(channel)) {
          return {
            isValid: false,
            error: `未知通道 '${channel}'`,
          };
        }
      }

      // 提取常数
      const constants = this.extractConstants();

      // 基本的语法检查
      if (!this.checkBasicSyntax()) {
        return {
          isValid: false,
          error: '表达式格式错误',
        };
      }

      return {
        isValid: true,
        referencedChannels: Array.from(referencedChannels),
        constants: Array.from(constants),
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  private checkBalancedParentheses(): boolean {
    let count = 0;
    for (const char of this.expression) {
      if (char === '(') count++;
      else if (char === ')') count--;
      if (count < 0) return false;
    }
    return count === 0;
  }

  private extractChannels(): Set<string> {
    const channels = new Set<string>();

    // 按长度降序排序，避免部分匹配
    const sortedChannels = Array.from(this.availableChannels).sort(
      (a, b) => b.length - a.length
    );

    for (const channel of sortedChannels) {
      // 使用单词边界匹配
      const regex = new RegExp(`\\b${channel}\\b`, 'g');
      if (regex.test(this.expression)) {
        channels.add(channel);
      }
    }

    // 检查是否有未知的标识符（可能是未知通道）
    // 移除所有已知的通道名称
    let temp = this.expression;
    for (const channel of sortedChannels) {
      const regex = new RegExp(`\\b${channel}\\b`, 'g');
      temp = temp.replace(regex, '');
    }

    // 移除所有数字、操作符、括号和空格
    temp = temp.replace(/[\d\s\+\-\*\/\(\)\.\(\)]/g, '');

    // 如果还有其他字符，可能是未知通道
    if (temp) {
      // 尝试提取可能的通道名称
      const unknownChannels = temp.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
      if (unknownChannels.length > 0 && unknownChannels[0]) {
        channels.add(unknownChannels[0]); // 添加第一个未知标识符，让后续检查捕获
      }
    }

    return channels;
  }

  private extractConstants(): Set<number> {
    const constants = new Set<number>();

    // 匹配整数和浮点数（包括负数）
    const regex = /-?\d+\.?\d*/g;
    const matches = this.expression.match(regex) || [];

    for (const match of matches) {
      if (match && match !== '-' && match !== '.') {
        const num = parseFloat(match);
        if (!isNaN(num)) {
          constants.add(num);
        }
      }
    }

    return constants;
  }

  private checkBasicSyntax(): boolean {
    // 移除所有已知的通道名称
    let temp = this.expression;
    const sortedChannels = Array.from(this.availableChannels).sort(
      (a, b) => b.length - a.length
    );

    for (const channel of sortedChannels) {
      const regex = new RegExp(`\\b${channel}\\b`, 'g');
      temp = temp.replace(regex, '');
    }

    // 移除所有数字、操作符、括号和空格
    temp = temp.replace(/[\d\s\+\-\*\/\(\)\.\(\)]/g, '');

    // 如果还有其他字符，说明表达式格式错误
    if (temp) {
      return false;
    }

    // 检查是否以操作符结尾
    if (/[\+\-\*\/]\s*$/.test(this.expression)) {
      return false;
    }

    // 检查是否以 ( 结尾
    if (this.expression.trim().endsWith('(')) {
      return false;
    }

    return true;
  }
}

/**
 * 表达式提取器 - 从表达式中提取操作数定义
 */
export class ExpressionExtractor {
  static extractOperands(
    expression: string,
    channelNames: string[]
  ): OperandDefinition[] {
    const validator = new ExpressionValidator(expression, channelNames);
    const validation = validator.validate();

    if (!validation.isValid) {
      throw new Error(validation.error || '表达式验证失败');
    }

    const operands: OperandDefinition[] = [];
    const seen = new Set<string>();

    if (validation.referencedChannels) {
      for (const channelName of validation.referencedChannels) {
        if (!seen.has(channelName)) {
          const channelIndex = channelNames.indexOf(channelName);
          if (channelIndex !== -1) {
            operands.push({
              id: `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              channelName,
              channelIndex,
              coefficient: 1.0,
            });
            seen.add(channelName);
          }
        }
      }
    }

    return operands;
  }
}

/**
 * 表达式预处理器 - 将表达式转换为可安全求值的形式
 */
export class ExpressionPreprocessor {
  static preprocess(expression: string, channelNames: string[]): string {
    // 验证表达式
    const validator = new ExpressionValidator(expression, channelNames);
    const validation = validator.validate();

    if (!validation.isValid) {
      throw new Error(validation.error || '表达式验证失败');
    }

    // 将通道名称替换为 channels['name'] 格式
    let processed = expression;

    // 按长度降序排序，避免部分匹配问题
    const sortedChannels = [...channelNames].sort((a, b) => b.length - a.length);

    for (const channelName of sortedChannels) {
      // 使用正则表达式匹配完整的通道名称（不在其他标识符中）
      const regex = new RegExp(`\\b${channelName}\\b`, 'g');
      processed = processed.replace(regex, `channels['${channelName}']`);
    }

    return processed;
  }
}

/**
 * 验证表达式
 */
export function validateExpression(expression: string, channelNames: string[]): SignalValidation {
  const validator = new ExpressionValidator(expression, channelNames);
  return validator.validate();
}

/**
 * 提取操作数
 */
export function extractOperands(
  expression: string,
  channelNames: string[]
): OperandDefinition[] {
  return ExpressionExtractor.extractOperands(expression, channelNames);
}

/**
 * 预处理表达式
 */
export function preprocessExpression(expression: string, channelNames: string[]): string {
  return ExpressionPreprocessor.preprocess(expression, channelNames);
}
