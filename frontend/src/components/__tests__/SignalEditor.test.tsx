/**
 * Signal Editor Component Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignalEditor } from '../SignalEditor';
import { Signal } from '../../types/signal';

describe('SignalEditor', () => {
  const mockChannelNames = ['Fp1', 'Fp2', 'F3', 'F4', 'Cz', 'Pz'];
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();

  const defaultProps = {
    isOpen: true,
    channelNames: mockChannelNames,
    onSave: mockOnSave,
    onCancel: mockOnCancel,
  };

  beforeEach(() => {
    mockOnSave.mockClear();
    mockOnCancel.mockClear();
  });

  describe('rendering', () => {
    it('应该在 isOpen 为 true 时渲染', () => {
      render(<SignalEditor {...defaultProps} />);
      expect(screen.getByText('创建新信号')).toBeInTheDocument();
    });

    it('应该在 isOpen 为 false 时不渲染', () => {
      const { container } = render(
        <SignalEditor {...defaultProps} isOpen={false} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('应该显示编辑标题当提供了信号', () => {
      const signal: Signal = {
        id: 'sig-1',
        name: 'Test Signal',
        expression: 'Fp1 - F3',
        operands: [],
        enabled: true,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      };

      render(<SignalEditor {...defaultProps} signal={signal} />);
      expect(screen.getByText('编辑信号')).toBeInTheDocument();
    });

    it('应该显示创建标题当没有提供信号', () => {
      render(<SignalEditor {...defaultProps} />);
      expect(screen.getByText('创建新信号')).toBeInTheDocument();
    });
  });

  describe('form initialization', () => {
    it('应该初始化空表单用于新信号', () => {
      render(<SignalEditor {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText('例如: Fp1-F7') as HTMLInputElement;
      expect(nameInput.value).toBe('');
    });

    it('应该用现有数据初始化表单用于编辑', () => {
      const signal: Signal = {
        id: 'sig-1',
        name: 'Fp1-F3',
        expression: 'Fp1 - F3',
        operands: [],
        description: 'Test description',
        color: '#ff0000',
        enabled: true,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      };

      render(<SignalEditor {...defaultProps} signal={signal} />);

      const nameInput = screen.getByPlaceholderText('例如: Fp1-F7') as HTMLInputElement;
      expect(nameInput.value).toBe('Fp1-F3');
    });
  });

  describe('form validation', () => {
    it('应该在名称为空时显示错误', async () => {
      render(<SignalEditor {...defaultProps} />);

      const saveButton = screen.getByText('创建');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('请输入信号名称')).toBeInTheDocument();
      });
    });

    it('应该在表达式无效时显示错误', async () => {
      render(<SignalEditor {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText('例如: Fp1-F7');
      await userEvent.type(nameInput, 'Test Signal');

      const saveButton = screen.getByText('创建');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('表达式无效')).toBeInTheDocument();
      });
    });

    it('应该在有效表达式时启用保存按钮', async () => {
      render(<SignalEditor {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText('例如: Fp1-F7');
      await userEvent.type(nameInput, 'Test Signal');

      // 输入有效的表达式
      const expressionInput = screen.getByDisplayValue('');
      await userEvent.type(expressionInput, 'Fp1 - F3');

      await waitFor(() => {
        const saveButton = screen.getByText('创建') as HTMLButtonElement;
        expect(saveButton.disabled).toBe(false);
      });
    });
  });

  describe('form submission', () => {
    it('应该在有效输入时调用 onSave', async () => {
      render(<SignalEditor {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText('例如: Fp1-F7');
      await userEvent.type(nameInput, 'Fp1-F3');

      const expressionInput = screen.getByDisplayValue('');
      await userEvent.type(expressionInput, 'Fp1 - F3');

      const saveButton = screen.getByText('创建');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
        const savedSignal = mockOnSave.mock.calls[0][0];
        expect(savedSignal.name).toBe('Fp1-F3');
        expect(savedSignal.expression).toBe('Fp1 - F3');
      });
    });

    it('应该在取消时调用 onCancel', () => {
      render(<SignalEditor {...defaultProps} />);

      const cancelButton = screen.getByText('取消');
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('应该在关闭按钮点击时调用 onCancel', () => {
      render(<SignalEditor {...defaultProps} />);

      const closeButton = screen.getByText('✕');
      fireEvent.click(closeButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('color picker', () => {
    it('应该允许选择颜色', async () => {
      render(<SignalEditor {...defaultProps} />);

      const colorInput = screen.getByDisplayValue('#2196f3') as HTMLInputElement;
      await userEvent.clear(colorInput);
      await userEvent.type(colorInput, '#ff0000');

      expect(colorInput.value).toBe('#ff0000');
    });
  });

  describe('description', () => {
    it('应该允许输入描述', async () => {
      render(<SignalEditor {...defaultProps} />);

      const descriptionInput = screen.getByPlaceholderText('可选的信号描述') as HTMLTextAreaElement;
      await userEvent.type(descriptionInput, 'Test description');

      expect(descriptionInput.value).toBe('Test description');
    });
  });
});
