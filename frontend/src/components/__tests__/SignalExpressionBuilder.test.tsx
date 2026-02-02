/**
 * SignalExpressionBuilder.test.tsx
 * SignalExpressionBuilder 组件的单元测试
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SignalExpressionBuilder } from '../SignalExpressionBuilder';

describe('SignalExpressionBuilder', () => {
  const mockChannelNames = ['Fp1', 'Fp2', 'F3', 'F4', 'C3', 'C4'];
  const defaultProps = {
    expression: '',
    channelNames: mockChannelNames,
    onExpressionChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('渲染', () => {
    it('应该渲染表达式输入框', () => {
      render(<SignalExpressionBuilder {...defaultProps} />);

      const input = screen.getByPlaceholderText('输入表达式或使用下方按钮构建');
      expect(input).toBeInTheDocument();
    });

    it('应该显示当前表达式值', () => {
      render(<SignalExpressionBuilder {...defaultProps} expression="Fp1 - F3" />);

      const input = screen.getByDisplayValue('Fp1 - F3');
      expect(input).toBeInTheDocument();
    });

    it('应该显示无效图标（空表达式）', () => {
      render(<SignalExpressionBuilder {...defaultProps} />);

      expect(screen.getByText('✗')).toBeInTheDocument();
    });

    it('应该显示有效图标（有效表达式）', () => {
      render(<SignalExpressionBuilder {...defaultProps} expression="Fp1" />);

      expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('应该显示错误消息', () => {
      render(<SignalExpressionBuilder {...defaultProps} expression="invalid + + +" />);

      // 错误消息可能是"表达式格式错误"或"未知通道"
      const errorMessage = screen.queryByText(/表达式格式错误/) || screen.queryByText(/未知通道/);
      expect(errorMessage).toBeInTheDocument();
    });
  });

  describe('表达式输入', () => {
    it('应该在用户输入时调用 onExpressionChange', () => {
      const onExpressionChange = vi.fn();
      render(<SignalExpressionBuilder {...defaultProps} onExpressionChange={onExpressionChange} />);

      const input = screen.getByPlaceholderText('输入表达式或使用下方按钮构建');
      fireEvent.change(input, { target: { value: 'Fp1 - F3' } });

      expect(onExpressionChange).toHaveBeenCalledWith('Fp1 - F3');
    });
  });

  describe('验证状态回调', () => {
    it('应该在表达式变为有效时调用 onValidationChange', () => {
      const onValidationChange = vi.fn();
      const { rerender } = render(
        <SignalExpressionBuilder
          {...defaultProps}
          expression=""
          onValidationChange={onValidationChange}
        />
      );

      // 空表达式无效
      expect(onValidationChange).toHaveBeenCalledWith(false);

      rerender(<SignalExpressionBuilder {...defaultProps} expression="Fp1" onValidationChange={onValidationChange} />);

      // 有效表达式
      expect(onValidationChange).toHaveBeenCalledWith(true);
    });
  });

  describe('显示/隐藏构建器', () => {
    it('默认应隐藏构建器', () => {
      render(<SignalExpressionBuilder {...defaultProps} />);

      expect(screen.queryByText('通道')).not.toBeInTheDocument();
    });

    it('点击按钮应显示构建器', () => {
      render(<SignalExpressionBuilder {...defaultProps} />);

      const toggleButton = screen.getByText('显示构建器');
      fireEvent.click(toggleButton);

      expect(screen.getByText('通道')).toBeInTheDocument();
      expect(screen.getByText('操作符')).toBeInTheDocument();
      expect(screen.getByText('括号')).toBeInTheDocument();
    });

    it('再次点击应隐藏构建器', () => {
      render(<SignalExpressionBuilder {...defaultProps} />);

      const toggleButton = screen.getByText('显示构建器');
      fireEvent.click(toggleButton);
      fireEvent.click(screen.getByText('隐藏构建器'));

      expect(screen.queryByText('通道')).not.toBeInTheDocument();
    });
  });

  describe('通道按钮', () => {
    it('应该渲染所有通道按钮', () => {
      render(<SignalExpressionBuilder {...defaultProps} />);

      // 显示构建器
      fireEvent.click(screen.getByText('显示构建器'));

      for (const channel of mockChannelNames) {
        expect(screen.getByText(channel)).toBeInTheDocument();
      }
    });

    it('点击通道按钮应添加到空表达式', () => {
      const onExpressionChange = vi.fn();
      render(<SignalExpressionBuilder {...defaultProps} onExpressionChange={onExpressionChange} />);

      fireEvent.click(screen.getByText('显示构建器'));
      fireEvent.click(screen.getByText('Fp1'));

      expect(onExpressionChange).toHaveBeenCalledWith('Fp1');
    });

    it('点击通道按钮应追加到已有表达式', () => {
      const onExpressionChange = vi.fn();
      render(
        <SignalExpressionBuilder
          {...defaultProps}
          expression="Fp1"
          onExpressionChange={onExpressionChange}
        />
      );

      fireEvent.click(screen.getByText('显示构建器'));
      fireEvent.click(screen.getByText('F3'));

      expect(onExpressionChange).toHaveBeenCalledWith('Fp1 + F3');
    });
  });

  describe('操作符按钮', () => {
    it('应该渲染所有操作符按钮', () => {
      render(<SignalExpressionBuilder {...defaultProps} />);

      fireEvent.click(screen.getByText('显示构建器'));

      expect(screen.getByText('+')).toBeInTheDocument();
      expect(screen.getByText('−')).toBeInTheDocument();
      expect(screen.getByText('×')).toBeInTheDocument();
      expect(screen.getByText('÷')).toBeInTheDocument();
    });

    it('点击操作符按钮应追加到表达式', () => {
      const onExpressionChange = vi.fn();
      render(
        <SignalExpressionBuilder
          {...defaultProps}
          expression="Fp1"
          onExpressionChange={onExpressionChange}
        />
      );

      fireEvent.click(screen.getByText('显示构建器'));
      fireEvent.click(screen.getByText('+'));

      expect(onExpressionChange).toHaveBeenCalledWith('Fp1 + ');
    });

    it('空表达式点击操作符不应更新', () => {
      const onExpressionChange = vi.fn();
      render(<SignalExpressionBuilder {...defaultProps} onExpressionChange={onExpressionChange} />);

      fireEvent.click(screen.getByText('显示构建器'));
      fireEvent.click(screen.getByText('+'));

      expect(onExpressionChange).not.toHaveBeenCalled();
    });
  });

  describe('括号按钮', () => {
    it('应该渲染括号按钮', () => {
      render(<SignalExpressionBuilder {...defaultProps} />);

      fireEvent.click(screen.getByText('显示构建器'));
      expect(screen.getByText('( )')).toBeInTheDocument();
    });

    it('点击括号按钮应包装空表达式', () => {
      const onExpressionChange = vi.fn();
      render(<SignalExpressionBuilder {...defaultProps} onExpressionChange={onExpressionChange} />);

      fireEvent.click(screen.getByText('显示构建器'));
      fireEvent.click(screen.getByText('( )'));

      expect(onExpressionChange).toHaveBeenCalledWith('()');
    });

    it('点击括号按钮应包装已有表达式', () => {
      const onExpressionChange = vi.fn();
      render(
        <SignalExpressionBuilder
          {...defaultProps}
          expression="Fp1 + F3"
          onExpressionChange={onExpressionChange}
        />
      );

      fireEvent.click(screen.getByText('显示构建器'));
      fireEvent.click(screen.getByText('( )'));

      expect(onExpressionChange).toHaveBeenCalledWith('(Fp1 + F3)');
    });
  });

  describe('清空按钮', () => {
    it('应该渲染清空按钮', () => {
      render(<SignalExpressionBuilder {...defaultProps} />);

      fireEvent.click(screen.getByText('显示构建器'));
      expect(screen.getByText('清空')).toBeInTheDocument();
    });

    it('点击清空按钮应清除表达式', () => {
      const onExpressionChange = vi.fn();
      render(
        <SignalExpressionBuilder
          {...defaultProps}
          expression="Fp1 + F3"
          onExpressionChange={onExpressionChange}
        />
      );

      fireEvent.click(screen.getByText('显示构建器'));
      fireEvent.click(screen.getByText('清空'));

      expect(onExpressionChange).toHaveBeenCalledWith('');
    });
  });

  describe('验证信息显示', () => {
    it('应该显示引用的通道', () => {
      render(<SignalExpressionBuilder {...defaultProps} expression="Fp1 + F3" />);

      expect(screen.getByText(/通道:/)).toBeInTheDocument();
      expect(screen.getByText(/Fp1, F3/)).toBeInTheDocument();
    });

    it('应该显示常数信息', () => {
      render(<SignalExpressionBuilder {...defaultProps} expression="Fp1 + 2.5" />);

      expect(screen.getByText(/常数:/)).toBeInTheDocument();
      expect(screen.getByText(/2\.5/)).toBeInTheDocument();
    });
  });

  describe('边界情况', () => {
    it('应处理空通道列表', () => {
      render(<SignalExpressionBuilder {...defaultProps} channelNames={[]} />);

      fireEvent.click(screen.getByText('显示构建器'));

      // 不应显示任何通道按钮
      expect(screen.queryByText('Fp1')).not.toBeInTheDocument();
    });

    it('应处理带特殊字符的通道名', () => {
      const specialChannels = ['CH-1', 'CH_2', 'CH 3'];
      render(
        <SignalExpressionBuilder
          {...defaultProps}
          channelNames={specialChannels}
        />
      );

      fireEvent.click(screen.getByText('显示构建器'));

      for (const channel of specialChannels) {
        expect(screen.getByText(channel)).toBeInTheDocument();
      }
    });

    it('应处理复杂表达式', () => {
      const complexExpression = '(Fp1 + Fp2) / 2 - (F3 + F4) / 2';
      render(<SignalExpressionBuilder {...defaultProps} expression={complexExpression} />);

      expect(screen.getByDisplayValue(complexExpression)).toBeInTheDocument();
      expect(screen.getByText('✓')).toBeInTheDocument();
    });
  });
});
