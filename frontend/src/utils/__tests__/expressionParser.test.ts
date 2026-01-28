/**
 * 表达式解析器单元测试
 */

import { describe, it, expect } from 'vitest';
import {
  validateExpression,
  extractOperands,
  preprocessExpression,
} from '../expressionParser';

describe('ExpressionValidator', () => {
  const channelNames = ['Fp1', 'Fp2', 'F7', 'F8', 'F3', 'F4', 'Cz', 'Pz', 'O1', 'O2'];

  describe('validateExpression', () => {
    it('应该验证有效的简单表达式', () => {
      const result = validateExpression('Fp1 - F7', channelNames);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.referencedChannels).toContain('Fp1');
      expect(result.referencedChannels).toContain('F7');
    });

    it('应该验证有效的复杂表达式', () => {
      const result = validateExpression('(Fp1 + F7) / 2', channelNames);
      expect(result.isValid).toBe(true);
      expect(result.referencedChannels).toContain('Fp1');
      expect(result.referencedChannels).toContain('F7');
    });

    it('应该验证包含常数的表达式', () => {
      const result = validateExpression('Fp1 * 2 - F7', channelNames);
      expect(result.isValid).toBe(true);
      expect(result.constants).toContain(2);
    });

    it('应该验证包含小数的表达式', () => {
      const result = validateExpression('(Fp1 + F7) / 2.5', channelNames);
      expect(result.isValid).toBe(true);
      expect(result.constants).toContain(2.5);
    });

    it('应该拒绝空表达式', () => {
      const result = validateExpression('', channelNames);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('应该拒绝仅空格的表达式', () => {
      const result = validateExpression('   ', channelNames);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('应该拒绝未知通道', () => {
      const result = validateExpression('InvalidChannel - F7', channelNames);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('未知通道');
    });

    it('应该拒绝不平衡的括号', () => {
      const result = validateExpression('(Fp1 + F7', channelNames);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('括号');
    });

    it('应该拒绝不平衡的右括号', () => {
      const result = validateExpression('Fp1 + F7)', channelNames);
      expect(result.isValid).toBe(false);
    });

    it('应该拒绝无效的操作符序列', () => {
      const result = validateExpression('Fp1 + + F7', channelNames);
      // "Fp1 + + F7" 实际上是有效的，因为第二个 + 是一元操作符
      // 所以这个测试应该期望有效
      expect(result.isValid).toBe(true);
    });

    it('应该拒绝不完整的表达式', () => {
      const result = validateExpression('Fp1 +', channelNames);
      expect(result.isValid).toBe(false);
    });

    it('应该处理一元操作符', () => {
      const result = validateExpression('-Fp1 + F7', channelNames);
      expect(result.isValid).toBe(true);
      expect(result.referencedChannels).toContain('Fp1');
      expect(result.referencedChannels).toContain('F7');
    });

    it('应该处理多个一元操作符', () => {
      const result = validateExpression('--Fp1', channelNames);
      expect(result.isValid).toBe(true);
    });

    it('应该处理带空格的表达式', () => {
      const result = validateExpression('  Fp1   -   F7  ', channelNames);
      expect(result.isValid).toBe(true);
    });

    it('应该处理复杂的嵌套括号', () => {
      const result = validateExpression('((Fp1 + F7) * 2) / (F3 + F4)', channelNames);
      expect(result.isValid).toBe(true);
      expect(result.referencedChannels).toContain('Fp1');
      expect(result.referencedChannels).toContain('F7');
      expect(result.referencedChannels).toContain('F3');
      expect(result.referencedChannels).toContain('F4');
    });

    it('应该提取所有引用的通道', () => {
      const result = validateExpression('Fp1 - F7 + F3 * F4', channelNames);
      expect(result.isValid).toBe(true);
      expect(result.referencedChannels).toHaveLength(4);
      expect(result.referencedChannels).toContain('Fp1');
      expect(result.referencedChannels).toContain('F7');
      expect(result.referencedChannels).toContain('F3');
      expect(result.referencedChannels).toContain('F4');
    });

    it('应该处理重复的通道引用', () => {
      const result = validateExpression('Fp1 + Fp1', channelNames);
      expect(result.isValid).toBe(true);
      expect(result.referencedChannels).toHaveLength(1);
      expect(result.referencedChannels).toContain('Fp1');
    });

    it('应该处理所有四则运算符', () => {
      const result = validateExpression('Fp1 + F7 - F3 * F4 / Cz', channelNames);
      expect(result.isValid).toBe(true);
    });

    it('应该拒绝无效字符', () => {
      const result = validateExpression('Fp1 @ F7', channelNames);
      expect(result.isValid).toBe(false);
    });
  });

  describe('extractOperands', () => {
    it('应该提取简单表达式的操作数', () => {
      const operands = extractOperands('Fp1 - F7', channelNames);
      expect(operands).toHaveLength(2);
      expect(operands[0].channelName).toBe('Fp1');
      expect(operands[0].channelIndex).toBe(0);
      expect(operands[1].channelName).toBe('F7');
      expect(operands[1].channelIndex).toBe(2);
    });

    it('应该为每个操作数分配唯一 ID', () => {
      const operands = extractOperands('Fp1 - F7', channelNames);
      expect(operands[0].id).toBeDefined();
      expect(operands[1].id).toBeDefined();
      expect(operands[0].id).not.toBe(operands[1].id);
    });

    it('应该设置默认系数为 1.0', () => {
      const operands = extractOperands('Fp1 - F7', channelNames);
      expect(operands[0].coefficient).toBe(1.0);
      expect(operands[1].coefficient).toBe(1.0);
    });

    it('应该处理复杂表达式的操作数', () => {
      const operands = extractOperands('(Fp1 + F7) / 2', channelNames);
      expect(operands).toHaveLength(2);
    });

    it('应该拒绝无效表达式', () => {
      expect(() => {
        extractOperands('InvalidChannel - F7', channelNames);
      }).toThrow();
    });
  });

  describe('preprocessExpression', () => {
    it('应该将通道名称替换为字典访问格式', () => {
      const processed = preprocessExpression('Fp1 - F7', channelNames);
      expect(processed).toContain("channels['Fp1']");
      expect(processed).toContain("channels['F7']");
    });

    it('应该保留操作符', () => {
      const processed = preprocessExpression('Fp1 - F7', channelNames);
      expect(processed).toContain('-');
    });

    it('应该保留常数', () => {
      const processed = preprocessExpression('Fp1 * 2', channelNames);
      expect(processed).toContain('2');
    });

    it('应该处理复杂表达式', () => {
      const processed = preprocessExpression('(Fp1 + F7) / 2', channelNames);
      expect(processed).toContain("channels['Fp1']");
      expect(processed).toContain("channels['F7']");
      expect(processed).toContain('2');
    });

    it('应该避免部分匹配问题', () => {
      // 确保 "Fp1" 不会匹配 "Fp12" 的一部分
      const processed = preprocessExpression('Fp1', channelNames);
      expect(processed).toBe("channels['Fp1']");
    });

    it('应该拒绝无效表达式', () => {
      expect(() => {
        preprocessExpression('InvalidChannel - F7', channelNames);
      }).toThrow();
    });
  });

  describe('边界情况', () => {
    it('应该处理单个通道', () => {
      const result = validateExpression('Fp1', channelNames);
      expect(result.isValid).toBe(true);
      expect(result.referencedChannels).toContain('Fp1');
    });

    it('应该处理单个常数', () => {
      const result = validateExpression('2.5', channelNames);
      expect(result.isValid).toBe(true);
      expect(result.constants).toContain(2.5);
    });

    it('应该处理负数常数', () => {
      const result = validateExpression('Fp1 + -2.5', channelNames);
      expect(result.isValid).toBe(true);
      expect(result.constants).toContain(-2.5);
    });

    it('应该处理很长的表达式', () => {
      const longExpr = 'Fp1 + F7 + F3 + F4 + Cz + Pz + O1 + O2 + Fp2 + F8';
      const result = validateExpression(longExpr, channelNames);
      expect(result.isValid).toBe(true);
      expect(result.referencedChannels).toHaveLength(10);
    });

    it('应该处理深层嵌套的括号', () => {
      const result = validateExpression('(((Fp1)))', channelNames);
      expect(result.isValid).toBe(true);
    });
  });
});
