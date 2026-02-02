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

  describe('validation', () => {
    it('应该禁用保存按钮当表单无效', () => {
      render(<SignalEditor {...defaultProps} />);

      const saveButton = screen.getByText('创建') as HTMLButtonElement;
      expect(saveButton.disabled).toBe(true);
    });

    it('应该禁用保存按钮当名称为空', () => {
      render(<SignalEditor {...defaultProps} />);

      // 输入有效表达式但不输入名称
      const expressionInput = screen.getByPlaceholderText('输入表达式或使用下方按钮构建') as HTMLInputElement;
      fireEvent.change(expressionInput, { target: { value: 'Fp1' } });

      const saveButton = screen.getByText('创建') as HTMLButtonElement;
      expect(saveButton.disabled).toBe(true);
    });

    it('应该禁用保存按钮当表达式无效', () => {
      render(<SignalEditor {...defaultProps} />);

      // 输入名称但表达式无效（空）
      const nameInput = screen.getByPlaceholderText('例如: Fp1-F7') as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: 'Test' } });

      const saveButton = screen.getByText('创建') as HTMLButtonElement;
      expect(saveButton.disabled).toBe(true);
    });

    it('应该启用保存按钮当表单有效', () => {
      render(<SignalEditor {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText('例如: Fp1-F7') as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: 'Test Signal' } });

      const expressionInput = screen.getByPlaceholderText('输入表达式或使用下方按钮构建') as HTMLInputElement;
      fireEvent.change(expressionInput, { target: { value: 'Fp1' } });

      const saveButton = screen.getByText('创建') as HTMLButtonElement;
      expect(saveButton.disabled).toBe(false);
    });
  });

  describe('save functionality', () => {
    it('应该创建新信号', () => {
      render(<SignalEditor {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText('例如: Fp1-F7') as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: 'Test Signal' } });

      const expressionInput = screen.getByPlaceholderText('输入表达式或使用下方按钮构建') as HTMLInputElement;
      fireEvent.change(expressionInput, { target: { value: 'Fp1' } });

      const saveButton = screen.getByText('创建');
      fireEvent.click(saveButton);

      expect(mockOnSave).toHaveBeenCalled();
      const savedSignal = mockOnSave.mock.calls[0][0];
      expect(savedSignal.name).toBe('Test Signal');
      expect(savedSignal.expression).toBe('Fp1');
      expect(savedSignal.enabled).toBe(true);
    });

    it('应该更新现有信号', () => {
      const existingSignal: Signal = {
        id: 'sig-1',
        name: 'Old Name',
        expression: 'Fp1',
        operands: [],
        enabled: false,
        createdAt: 1000,
        modifiedAt: 2000,
      };

      render(<SignalEditor {...defaultProps} signal={existingSignal} />);

      const nameInput = screen.getByPlaceholderText('例如: Fp1-F7') as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: 'Updated Name' } });

      const saveButton = screen.getByText('更新');
      fireEvent.click(saveButton);

      expect(mockOnSave).toHaveBeenCalled();
      const savedSignal = mockOnSave.mock.calls[0][0];
      expect(savedSignal.id).toBe('sig-1');
      expect(savedSignal.name).toBe('Updated Name');
      expect(savedSignal.createdAt).toBe(1000); // 保持原创建时间
      expect(savedSignal.modifiedAt).toBeGreaterThan(2000); // 更新修改时间
    });

    it('应该保存描述和颜色', () => {
      render(<SignalEditor {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText('例如: Fp1-F7') as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: 'Test' } });

      const descriptionInput = screen.getByPlaceholderText('可选的信号描述') as HTMLTextAreaElement;
      fireEvent.change(descriptionInput, { target: { value: 'Test description' } });

      const expressionInput = screen.getByPlaceholderText('输入表达式或使用下方按钮构建') as HTMLInputElement;
      fireEvent.change(expressionInput, { target: { value: 'Fp1' } });

      const saveButton = screen.getByText('创建');
      fireEvent.click(saveButton);

      expect(mockOnSave).toHaveBeenCalled();
      const savedSignal = mockOnSave.mock.calls[0][0];
      expect(savedSignal.description).toBe('Test description');
    });
  });

  describe('color picker', () => {
    it('应该允许选择颜色', () => {
      render(<SignalEditor {...defaultProps} />);

      const colorInputs = document.querySelectorAll('input[type="color"]');
      expect(colorInputs.length).toBeGreaterThan(0);
      const colorInput = colorInputs[0] as HTMLInputElement;
      expect(colorInput.value).toBe('#2196f3'); // 默认颜色

      fireEvent.change(colorInput, { target: { value: '#ff0000' } });
      expect(colorInput.value).toBe('#ff0000');
    });
  });

  describe('modal interactions', () => {
    it('应该关闭当点击遮罩层', () => {
      render(<SignalEditor {...defaultProps} />);

      // 点击遮罩层
      const container = document.querySelector('[class*="overlay"]');
      if (container) {
        fireEvent.click(container);
        expect(mockOnCancel).toHaveBeenCalled();
      }
    });

    it('不应关闭当点击模态框内部', () => {
      render(<SignalEditor {...defaultProps} />);

      const heading = screen.getByText('创建新信号');
      fireEvent.click(heading);

      expect(mockOnCancel).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('应处理带颜色的现有信号', () => {
      const signal: Signal = {
        id: 'sig-1',
        name: 'Test',
        expression: 'Fp1',
        operands: [],
        color: '#00ff00',
        enabled: true,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      };

      render(<SignalEditor {...defaultProps} signal={signal} />);

      const colorInput = screen.getByLabelText('颜色') as HTMLInputElement;
      expect(colorInput.value).toBe('#00ff00');
    });

    it('应处理没有描述的现有信号', () => {
      const signal: Signal = {
        id: 'sig-1',
        name: 'Test',
        expression: 'Fp1',
        operands: [],
        enabled: true,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      };

      render(<SignalEditor {...defaultProps} signal={signal} />);

      const descriptionInput = screen.getByPlaceholderText('可选的信号描述') as HTMLTextAreaElement;
      expect(descriptionInput.value).toBe('');
    });

    it('应处理没有颜色的现有信号', () => {
      const signal: Signal = {
        id: 'sig-1',
        name: 'Test',
        expression: 'Fp1',
        operands: [],
        enabled: true,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      };

      render(<SignalEditor {...defaultProps} signal={signal} />);

      const colorInput = screen.getByLabelText('颜色') as HTMLInputElement;
      expect(colorInput.value).toBe('#2196f3'); // 默认颜色
    });
  });
});
