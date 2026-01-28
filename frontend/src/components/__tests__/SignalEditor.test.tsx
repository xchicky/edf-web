/**
 * Signal Editor Component Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SignalEditor } from '../SignalEditor';
import type { Signal } from '../../types/signal';

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

  describe('form submission', () => {
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

  describe('description', () => {
    it('应该允许输入描述', () => {
      render(<SignalEditor {...defaultProps} />);

      const descriptionInput = screen.getByPlaceholderText('可选的信号描述') as HTMLTextAreaElement;
      fireEvent.change(descriptionInput, { target: { value: 'Test description' } });

      expect(descriptionInput.value).toBe('Test description');
    });
  });
});
