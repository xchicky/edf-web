/**
 * PreprocessSelector 组件测试
 *
 * 测试预处理方法选择器的渲染和交互功能
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PreprocessSelector } from '../PreprocessSelector';
import type { PreprocessConfig } from '../../types/analysis';

describe('PreprocessSelector', () => {
  const mockOnConfigChange = vi.fn();
  const defaultConfig: PreprocessConfig = { method: 'none', parameters: null };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('渲染测试', () => {
    it('应该渲染选择器组件', () => {
      render(
        <PreprocessSelector
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
        />
      );

      expect(screen.getByText(/信号预处理/i)).toBeInTheDocument();
    });

    it('应该显示当前选中的方法', () => {
      const config: PreprocessConfig = { method: 'linear_detrend', parameters: null };
      render(
        <PreprocessSelector
          config={config}
          onConfigChange={mockOnConfigChange}
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('linear_detrend');
    });

    it('禁用状态下不应允许交互', () => {
      render(
        <PreprocessSelector
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
          disabled={true}
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toBeDisabled();
    });

    it('应该显示方法描述', () => {
      render(
        <PreprocessSelector
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
        />
      );

      expect(screen.getByText('保持原始信号')).toBeInTheDocument();
    });
  });

  describe('方法选择测试', () => {
    it('应该包含所有预处理方法选项', () => {
      render(
        <PreprocessSelector
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
        />
      );

      screen.getByRole('combobox');

      expect(screen.getByRole('option', { name: /无预处理.*保持原始信号/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /线性去漂移.*适用于线性漂移/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /多项式去漂移.*适用于复杂漂移/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /高通滤波.*适用于低频漂移/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /基线校正.*使用移动平均/i })).toBeInTheDocument();
    });

    it('选择方法时应调用回调函数', async () => {
      render(
        <PreprocessSelector
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
        />
      );

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'linear_detrend' } });

      expect(mockOnConfigChange).toHaveBeenCalledTimes(1);
      expect(mockOnConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'linear_detrend' })
      );
    });

    it('选择多项式去漂移应使用默认参数', () => {
      render(
        <PreprocessSelector
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
        />
      );

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'polynomial_detrend' } });

      expect(mockOnConfigChange).toHaveBeenCalledWith({
        method: 'polynomial_detrend',
        parameters: { order: 2 },
      });
    });

    it('选择高通滤波应使用默认参数', () => {
      render(
        <PreprocessSelector
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
        />
      );

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'highpass_filter' } });

      expect(mockOnConfigChange).toHaveBeenCalledWith({
        method: 'highpass_filter',
        parameters: { cutoff: 0.5 },
      });
    });
  });

  describe('参数调节测试', () => {
    it('多项式去漂移应显示 order 参数滑块', () => {
      const config: PreprocessConfig = { method: 'polynomial_detrend', parameters: { order: 2 } };
      render(
        <PreprocessSelector
          config={config}
          onConfigChange={mockOnConfigChange}
        />
      );

      expect(screen.getByText(/多项式阶数/)).toBeInTheDocument();

      const slider = screen.getByRole('slider');
      expect(slider).toHaveValue('2');
    });

    it('高通滤波应显示 cutoff 参数滑块', () => {
      const config: PreprocessConfig = { method: 'highpass_filter', parameters: { cutoff: 0.5 } };
      render(
        <PreprocessSelector
          config={config}
          onConfigChange={mockOnConfigChange}
        />
      );

      expect(screen.getByText(/截止频率.*Hz/)).toBeInTheDocument();

      const slider = screen.getByRole('slider');
      expect(slider).toHaveValue('0.5');
    });

    it('调整滑块应更新参数', () => {
      const config: PreprocessConfig = { method: 'polynomial_detrend', parameters: { order: 2 } };
      render(
        <PreprocessSelector
          config={config}
          onConfigChange={mockOnConfigChange}
        />
      );

      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '3' } });

      expect(mockOnConfigChange).toHaveBeenCalledWith({
        method: 'polynomial_detrend',
        parameters: { order: 3 },
      });
    });

    it('无参数的方法不应显示滑块', () => {
      render(
        <PreprocessSelector
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
        />
      );

      expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    });
  });

  describe('可访问性测试', () => {
    it('应该有正确的标签关联', () => {
      render(
        <PreprocessSelector
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
        />
      );

      const label = screen.getByText(/信号预处理/i);
      expect(label).toBeInTheDocument();
    });

    it('下拉框应该可以交互', () => {
      render(
        <PreprocessSelector
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      expect(select).not.toBeDisabled();
    });
  });

  describe('边缘情况测试', () => {
    it('空回调函数不应导致渲染错误', () => {
      expect(() => {
        render(
          <PreprocessSelector
            config={defaultConfig}
            onConfigChange={undefined as never}
          />
        );
      }).not.toThrow();
    });

    it('缺失 parameters 时应使用 null', () => {
      const config: PreprocessConfig = { method: 'none' };
      render(
        <PreprocessSelector
          config={config}
          onConfigChange={mockOnConfigChange}
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('none');
    });
  });
});
