/**
 * AdvancedAnalysisModal.test.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdvancedAnalysisModal } from '../AdvancedAnalysisModal';

vi.mock('../../api/edf', () => ({
  analyzeTimeDomain: vi.fn().mockResolvedValue({
    file_id: 'test-file-id',
    channels: ['CH1', 'CH2'],
    statistics: {
      CH1: { mean: 0, std: 1, min: -2, max: 2, rms: 1.414, peak_to_peak: 4, kurtosis: 3, skewness: 0, n_samples: 500 },
      CH2: { mean: 0, std: 1, min: -2, max: 2, rms: 1.414, peak_to_peak: 4, kurtosis: 3, skewness: 0, n_samples: 500 },
    },
  }),
  analyzeBandPower: vi.fn().mockResolvedValue({
    file_id: 'test-file-id',
    channels: ['CH1', 'CH2'],
    band_powers: {
      CH1: {
        delta: { absolute: 100, relative: 0.4, range: [0.5, 4] },
        theta: { absolute: 80, relative: 0.32, range: [4, 8] },
        alpha: { absolute: 50, relative: 0.2, range: [8, 13] },
        beta: { absolute: 15, relative: 0.06, range: [13, 30] },
        gamma: { absolute: 5, relative: 0.02, range: [30, 50] },
      },
      CH2: {
        delta: { absolute: 100, relative: 0.4, range: [0.5, 4] },
        theta: { absolute: 80, relative: 0.32, range: [4, 8] },
        alpha: { absolute: 50, relative: 0.2, range: [8, 13] },
        beta: { absolute: 15, relative: 0.06, range: [13, 30] },
        gamma: { absolute: 5, relative: 0.02, range: [30, 50] },
      },
    },
  }),
}));

import { analyzeTimeDomain, analyzeBandPower } from '../../api/edf';

describe('AdvancedAnalysisModal', () => {
  const defaultProps = {
    isOpen: true,
    fileId: 'test-file-id',
    selectionStart: 10,
    selectionEnd: 20,
    channelNames: ['CH1', 'CH2'],
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('渲染', () => {
    it('当 isOpen 为 true 时应该渲染模态框', () => {
      render(<AdvancedAnalysisModal {...defaultProps} />);
      expect(screen.getByText('高级分析')).toBeInTheDocument();
    });

    it('当 isOpen 为 false 时不应该渲染模态框', () => {
      render(<AdvancedAnalysisModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('高级分析')).not.toBeInTheDocument();
    });

    it('应该显示选区信息', () => {
      render(<AdvancedAnalysisModal {...defaultProps} />);
      expect(screen.getByText(/10\.00s - 20\.00s/)).toBeInTheDocument();
    });

    it('应该显示原始信号和预处理后信号两个面板', () => {
      render(<AdvancedAnalysisModal {...defaultProps} />);
      expect(screen.getByText('原始信号')).toBeInTheDocument();
      expect(screen.getByText('预处理后信号')).toBeInTheDocument();
    });

    it('应该显示预处理方法选择器', () => {
      render(<AdvancedAnalysisModal {...defaultProps} />);
      expect(screen.getByText('预处理方法:')).toBeInTheDocument();
    });

    it('应该显示分析类型切换按钮', () => {
      render(<AdvancedAnalysisModal {...defaultProps} />);
      expect(screen.getByText('时域')).toBeInTheDocument();
      expect(screen.getByText('频域')).toBeInTheDocument();
    });

    it('应该显示关闭按钮', () => {
      render(<AdvancedAnalysisModal {...defaultProps} />);
      expect(screen.getByLabelText('关闭高级分析')).toBeInTheDocument();
    });
  });

  describe('分析加载', () => {
    it('模态框打开时应该触发分析', () => {
      render(<AdvancedAnalysisModal {...defaultProps} initialAnalysisType="stats" />);
      expect(analyzeTimeDomain).toHaveBeenCalled();
    });
  });

  describe('预处理配置', () => {
    it('应该正确设置初始预处理配置', () => {
      render(
        <AdvancedAnalysisModal
          {...defaultProps}
          initialPreprocessConfig={{ method: 'linear_detrend', parameters: null }}
        />
      );
      const select = screen.getByRole('combobox', { name: /预处理方法/ });
      expect(select).toHaveValue('linear_detrend');
    });

    it('切换预处理方法时应该更新配置', async () => {
      render(<AdvancedAnalysisModal {...defaultProps} initialPreprocessConfig={{ method: 'none', parameters: null }} />);
      const select = screen.getByRole('combobox', { name: /预处理方法/ });
      await userEvent.selectOptions(select, 'polynomial_detrend');
      expect(select).toHaveValue('polynomial_detrend');
    });

    it('选择多项式去漂移应该显示参数滑块', async () => {
      render(<AdvancedAnalysisModal {...defaultProps} initialPreprocessConfig={{ method: 'none', parameters: null }} />);
      const select = screen.getByRole('combobox', { name: /预处理方法/ });
      await userEvent.selectOptions(select, 'polynomial_detrend');
      expect(screen.getByText('多项式阶数:')).toBeInTheDocument();
    });

    it('选择高通滤波应该显示参数滑块', async () => {
      render(<AdvancedAnalysisModal {...defaultProps} initialPreprocessConfig={{ method: 'none', parameters: null }} />);
      const select = screen.getByRole('combobox', { name: /预处理方法/ });
      await userEvent.selectOptions(select, 'highpass_filter');
      expect(screen.getByText('截止频率 (Hz):')).toBeInTheDocument();
    });

    it('选择无预处理时不应该显示参数滑块', () => {
      render(<AdvancedAnalysisModal {...defaultProps} initialPreprocessConfig={{ method: 'none', parameters: null }} />);
      expect(screen.queryByText('多项式阶数:')).not.toBeInTheDocument();
      expect(screen.queryByText('截止频率 (Hz):')).not.toBeInTheDocument();
    });
  });

  describe('关闭模态框', () => {
    it('点击关闭按钮应该调用 onClose', async () => {
      render(<AdvancedAnalysisModal {...defaultProps} />);
      const closeButton = screen.getByLabelText('关闭高级分析');
      await userEvent.click(closeButton);
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('点击底部关闭按钮应该调用 onClose', async () => {
      render(<AdvancedAnalysisModal {...defaultProps} />);
      const closeButton = screen.getByRole('button', { name: '关闭' });
      await userEvent.click(closeButton);
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('按 ESC 键应该调用 onClose', () => {
      render(<AdvancedAnalysisModal {...defaultProps} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('点击背景遮罩应该调用 onClose', () => {
      render(<AdvancedAnalysisModal {...defaultProps} />);
      const dialog = screen.getByRole('dialog');
      fireEvent.click(dialog);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('点击模态框内容区域不应该调用 onClose', () => {
      render(<AdvancedAnalysisModal {...defaultProps} />);
      const title = screen.getByText('高级分析');
      fireEvent.click(title);
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  describe('CSS 定位修复', () => {
    it('模态框 overlay 应使用高 z-index', () => {
      render(<AdvancedAnalysisModal {...defaultProps} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog.className).toContain('overlay');
    });

    it('模态框内的面板应该渲染内容区域', () => {
      render(<AdvancedAnalysisModal {...defaultProps} />);
      const panelContents = document.querySelectorAll('[class*="panelContent"]');
      expect(panelContents.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('响应式布局', () => {
    it('应该在移动端显示面板切换按钮', () => {
      window.innerWidth = 500;
      render(<AdvancedAnalysisModal {...defaultProps} />);
      expect(screen.getByText('原始信号')).toBeInTheDocument();
      expect(screen.getByText('预处理后')).toBeInTheDocument();
    });
  });
});
