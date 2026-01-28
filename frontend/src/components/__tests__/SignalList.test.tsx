/**
 * Signal List Component Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignalList } from '../SignalList';
import { Signal } from '../../types/signal';

describe('SignalList', () => {
  const mockSignals: Signal[] = [
    {
      id: 'sig-1',
      name: 'Fp1-F3',
      expression: 'Fp1 - F3',
      operands: [],
      enabled: true,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    },
    {
      id: 'sig-2',
      name: 'Fp2-F4',
      expression: 'Fp2 - F4',
      operands: [],
      description: 'Test description',
      enabled: false,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    },
  ];

  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnToggle = vi.fn();
  const mockOnAddNew = vi.fn();

  const defaultProps = {
    signals: mockSignals,
    onEdit: mockOnEdit,
    onDelete: mockOnDelete,
    onToggle: mockOnToggle,
    onAddNew: mockOnAddNew,
  };

  beforeEach(() => {
    mockOnEdit.mockClear();
    mockOnDelete.mockClear();
    mockOnToggle.mockClear();
    mockOnAddNew.mockClear();
  });

  describe('rendering', () => {
    it('应该渲染信号列表', () => {
      render(<SignalList {...defaultProps} />);
      expect(screen.getByText('Fp1-F3')).toBeInTheDocument();
      expect(screen.getByText('Fp2-F4')).toBeInTheDocument();
    });

    it('应该显示信号表达式', () => {
      render(<SignalList {...defaultProps} />);
      expect(screen.getByText('Fp1 - F3')).toBeInTheDocument();
      expect(screen.getByText('Fp2 - F4')).toBeInTheDocument();
    });

    it('应该显示信号描述', () => {
      render(<SignalList {...defaultProps} />);
      expect(screen.getByText('Test description')).toBeInTheDocument();
    });

    it('应该在没有信号时显示空状态', () => {
      render(<SignalList {...defaultProps} signals={[]} />);
      expect(screen.getByText('还没有派生信号')).toBeInTheDocument();
      expect(screen.getByText('创建第一个信号')).toBeInTheDocument();
    });
  });

  describe('header', () => {
    it('应该显示标题', () => {
      render(<SignalList {...defaultProps} />);
      expect(screen.getByText('派生信号')).toBeInTheDocument();
    });

    it('应该显示添加按钮', () => {
      render(<SignalList {...defaultProps} />);
      expect(screen.getByText('+ 添加信号')).toBeInTheDocument();
    });

    it('应该在点击添加按钮时调用 onAddNew', () => {
      render(<SignalList {...defaultProps} />);
      const addButton = screen.getByText('+ 添加信号');
      fireEvent.click(addButton);
      expect(mockOnAddNew).toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('应该按名称过滤信号', async () => {
      render(<SignalList {...defaultProps} />);
      const searchInput = screen.getByPlaceholderText('搜索信号...');
      await userEvent.type(searchInput, 'Fp1');

      expect(screen.getByText('Fp1-F3')).toBeInTheDocument();
      expect(screen.queryByText('Fp2-F4')).not.toBeInTheDocument();
    });

    it('应该按表达式过滤信号', async () => {
      render(<SignalList {...defaultProps} />);
      const searchInput = screen.getByPlaceholderText('搜索信号...');
      await userEvent.type(searchInput, 'Fp2 - F4');

      expect(screen.getByText('Fp2-F4')).toBeInTheDocument();
      expect(screen.queryByText('Fp1-F3')).not.toBeInTheDocument();
    });

    it('应该在没有匹配时显示空状态', async () => {
      render(<SignalList {...defaultProps} />);
      const searchInput = screen.getByPlaceholderText('搜索信号...');
      await userEvent.type(searchInput, 'NonExistent');

      expect(screen.getByText('没有匹配的信号')).toBeInTheDocument();
    });
  });

  describe('checkbox', () => {
    it('应该显示启用/禁用复选框', () => {
      render(<SignalList {...defaultProps} />);
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(2);
    });

    it('应该在点击复选框时调用 onToggle', () => {
      render(<SignalList {...defaultProps} />);
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      expect(mockOnToggle).toHaveBeenCalledWith('sig-1');
    });

    it('应该反映信号的启用状态', () => {
      render(<SignalList {...defaultProps} />);
      const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
      expect(checkboxes[0].checked).toBe(true);
      expect(checkboxes[1].checked).toBe(false);
    });
  });

  describe('actions', () => {
    it('应该显示编辑按钮', () => {
      render(<SignalList {...defaultProps} />);
      const editButtons = screen.getAllByText('编辑');
      expect(editButtons).toHaveLength(2);
    });

    it('应该在点击编辑按钮时调用 onEdit', () => {
      render(<SignalList {...defaultProps} />);
      const editButtons = screen.getAllByText('编辑');
      fireEvent.click(editButtons[0]);
      expect(mockOnEdit).toHaveBeenCalledWith(mockSignals[0]);
    });

    it('应该显示删除按钮', () => {
      render(<SignalList {...defaultProps} />);
      const deleteButtons = screen.getAllByText('删除');
      expect(deleteButtons).toHaveLength(2);
    });

    it('应该在点击删除按钮时显示确认对话框', () => {
      render(<SignalList {...defaultProps} />);
      const deleteButtons = screen.getAllByText('删除');
      fireEvent.click(deleteButtons[0]);
      expect(screen.getByText('确定要删除此信号吗？')).toBeInTheDocument();
    });

    it('应该在确认删除时调用 onDelete', () => {
      render(<SignalList {...defaultProps} />);
      const deleteButtons = screen.getAllByText('删除');
      fireEvent.click(deleteButtons[0]);

      const confirmButton = screen.getByText('确定');
      fireEvent.click(confirmButton);

      expect(mockOnDelete).toHaveBeenCalledWith('sig-1');
    });

    it('应该在取消删除时隐藏确认对话框', () => {
      render(<SignalList {...defaultProps} />);
      const deleteButtons = screen.getAllByText('删除');
      fireEvent.click(deleteButtons[0]);

      expect(screen.getByText('确定要删除此信号吗？')).toBeInTheDocument();

      const cancelButton = screen.getByText('取消');
      fireEvent.click(cancelButton);

      expect(screen.queryByText('确定要删除此信号吗？')).not.toBeInTheDocument();
    });
  });

  describe('color indicator', () => {
    it('应该显示颜色指示器', () => {
      render(<SignalList {...defaultProps} />);
      const colorIndicators = screen.getAllByTitle('信号颜色');
      expect(colorIndicators).toHaveLength(2);
    });
  });

  describe('metadata', () => {
    it('应该显示创建和修改时间', () => {
      render(<SignalList {...defaultProps} />);
      const metaItems = screen.getAllByText(/创建:|修改:/);
      expect(metaItems.length).toBeGreaterThan(0);
    });
  });
});
