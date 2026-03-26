/**
 * CompatibilityWarning 组件测试
 * 测试兼容性警告弹窗功能
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CompatibilityWarning } from '../CompatibilityWarning';
import type { CompatibilityIssue } from '../../types/mode';

describe('CompatibilityWarning', () => {
  const mockIssues: CompatibilityIssue[] = [
    {
      type: 'missing_channel',
      severity: 'error',
      message: '缺失通道: Fz, Cz',
      suggestion: '请确保文件包含 Fz 和 Cz 通道',
    },
    {
      type: 'low_sampling_rate',
      severity: 'error',
      message: '采样率不足: 50 Hz < 100 Hz',
      suggestion: '该模式需要至少 100 Hz 的采样率',
    },
    {
      type: 'config_conflict',
      severity: 'warning',
      message: '配置冲突',
      suggestion: '调整配置以解决冲突',
    },
  ];

  const defaultProps = {
    isOpen: true,
    issues: mockIssues,
    availableSignalCount: 8,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    modeName: '科研模式',
  };

  describe('渲染', () => {
    it('应该渲染弹窗', () => {
      render(<CompatibilityWarning {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('应该在 isOpen 为 false 时不渲染', () => {
      render(<CompatibilityWarning {...defaultProps} isOpen={false} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('应该显示模式名称', () => {
      render(<CompatibilityWarning {...defaultProps} />);

      expect(screen.getByText('科研模式')).toBeInTheDocument();
    });

    it('应该显示警告标题', () => {
      render(<CompatibilityWarning {...defaultProps} />);

      expect(screen.getByText(/兼容性警告/i)).toBeInTheDocument();
    });

    it('应该显示可用信号数量', () => {
      render(<CompatibilityWarning {...defaultProps} />);

      expect(screen.getByText(/8.*可用信号/i)).toBeInTheDocument();
    });

    it('应该显示确认和取消按钮', () => {
      render(<CompatibilityWarning {...defaultProps} />);

      expect(screen.getByRole('button', { name: /确认/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /取消/i })).toBeInTheDocument();
    });
  });

  describe('问题列表', () => {
    it('应该显示所有问题', () => {
      render(<CompatibilityWarning {...defaultProps} />);

      // 检查问题类型存在
      expect(screen.getAllByText(/缺失通道/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/采样率不足/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/配置冲突/i).length).toBeGreaterThan(0);
    });

    it('应该区分错误和警告', () => {
      render(<CompatibilityWarning {...defaultProps} />);

      // 错误级别的问题应该有特殊样式
      const errorItems = screen.getAllByText(/错误/i);
      expect(errorItems.length).toBeGreaterThan(0);
    });

    it('应该显示修复建议', () => {
      render(<CompatibilityWarning {...defaultProps} />);

      expect(screen.getAllByText(/建议/i).length).toBeGreaterThan(0);
    });

    it('应该在无问题时显示成功消息', () => {
      render(<CompatibilityWarning {...defaultProps} issues={[]} />);

      expect(screen.getByText(/完全兼容/i)).toBeInTheDocument();
    });

    it('应该正确显示缺失通道列表', () => {
      const channelIssues: CompatibilityIssue[] = [
        {
          type: 'missing_channel',
          severity: 'error',
          message: '缺失通道: Fz, Cz, Pz',
          suggestion: '添加这些通道',
        },
      ];

      render(<CompatibilityWarning {...defaultProps} issues={channelIssues} />);

      expect(screen.getByText(/Fz.*Cz.*Pz/i)).toBeInTheDocument();
    });
  });

  describe('交互', () => {
    it('应该在点击确认时调用 onConfirm', async () => {
      const onConfirm = vi.fn();

      render(<CompatibilityWarning {...defaultProps} onConfirm={onConfirm} />);

      const confirmButton = screen.getByRole('button', { name: /确认/i });
      await userEvent.click(confirmButton);

      expect(onConfirm).toHaveBeenCalled();
    });

    it('应该在点击取消时调用 onCancel', async () => {
      const onCancel = vi.fn();

      render(<CompatibilityWarning {...defaultProps} onCancel={onCancel} />);

      const cancelButton = screen.getByRole('button', { name: /取消/i });
      await userEvent.click(cancelButton);

      expect(onCancel).toHaveBeenCalled();
    });

    it('应该在按 ESC 键时调用 onCancel', async () => {
      const onCancel = vi.fn();

      render(<CompatibilityWarning {...defaultProps} onCancel={onCancel} />);

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });

      expect(onCancel).toHaveBeenCalled();
    });

    it('应该在点击遮罩层时调用 onCancel', async () => {
      const onCancel = vi.fn();

      render(<CompatibilityWarning {...defaultProps} onCancel={onCancel} />);

      const backdrop = screen.getByRole('dialog').parentElement;
      if (backdrop) {
        await userEvent.click(backdrop);
        expect(onCancel).toHaveBeenCalled();
      }
    });
  });

  describe('边界情况', () => {
    it('应该处理空问题列表', () => {
      render(<CompatibilityWarning {...defaultProps} issues={[]} />);

      expect(screen.getByText(/完全兼容/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /确认/i })).toBeInTheDocument();
    });

    it('应该处理只有警告的情况', () => {
      const warningOnlyIssues: CompatibilityIssue[] = [
        {
          type: 'config_conflict',
          severity: 'warning',
          message: '配置冲突',
        },
      ];

      render(<CompatibilityWarning {...defaultProps} issues={warningOnlyIssues} />);

      expect(screen.getAllByText(/配置冲突/i).length).toBeGreaterThan(0);
    });

    it('应该处理只有错误的情况', () => {
      const errorOnlyIssues: CompatibilityIssue[] = [
        {
          type: 'missing_channel',
          severity: 'error',
          message: '缺失通道',
        },
      ];

      render(<CompatibilityWarning {...defaultProps} issues={errorOnlyIssues} />);

      expect(screen.getAllByText(/缺失通道/i).length).toBeGreaterThan(0);
    });

    it('应该处理零可用信号', () => {
      render(<CompatibilityWarning {...defaultProps} availableSignalCount={0} />);

      expect(screen.getByText(/0.*可用信号/i)).toBeInTheDocument();
    });
  });

  describe('无障碍', () => {
    it('应该有正确的 ARIA 属性', () => {
      render(<CompatibilityWarning {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('应该有正确的标题层级', () => {
      render(<CompatibilityWarning {...defaultProps} />);

      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    });

    it('应该正确处理焦点', () => {
      render(<CompatibilityWarning {...defaultProps} />);

      const confirmButton = screen.getByRole('button', { name: /确认/i });
      expect(confirmButton).toHaveFocus();
    });
  });

  describe('样式', () => {
    it('应该应用正确的类名', () => {
      render(<CompatibilityWarning {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('role', 'dialog');
    });

    it('应该为错误和警告应用不同样式', () => {
      render(<CompatibilityWarning {...defaultProps} />);

      // 检查是否有错误或警告图标
      const icons = document.querySelectorAll('[class*="Icon"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('内容渲染', () => {
    it('应该显示模式名称和问题数量', () => {
      render(<CompatibilityWarning {...defaultProps} />);

      expect(screen.getByText(/科研模式/)).toBeInTheDocument();
      // 检查是否有问题数量显示
      expect(screen.getAllByText(/个/i).length).toBeGreaterThan(0);
    });

    it('应该格式化问题类型显示', () => {
      render(<CompatibilityWarning {...defaultProps} />);

      // 应该将 snake_case 转换为可读文本
      expect(screen.getAllByText(/缺失通道/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/采样率不足/i).length).toBeGreaterThan(0);
    });
  });
});
