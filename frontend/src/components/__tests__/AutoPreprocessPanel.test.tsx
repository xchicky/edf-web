/**
 * AutoPreprocessPanel.test.tsx
 *
 * AutoPreprocessPanel 组件测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AutoPreprocessPanel } from '../AutoPreprocessPanel';

// Mock API 函数
vi.mock('../../api/edf', () => ({
  runAutoPreprocess: vi.fn(),
}));

import { runAutoPreprocess } from '../../api/edf';

describe('AutoPreprocessPanel', () => {
  const defaultProps = {
    fileId: 'test-file-id',
    channelNames: ['Fp1', 'Fp2', 'F3', 'F4', 'C3', 'C4'],
  };

  const mockPreprocessResponse = {
    file_id: 'test-file-id',
    processing_time: 5.23,
    channel_types: {
      Fp1: 'eeg',
      Fp2: 'eeg',
      F3: 'eeg',
      F4: 'eeg',
      C3: 'eeg',
      C4: 'eeg',
    },
    preprocess_log: {
      reference: { method: 'average', channels: ['Fp1', 'Fp2', 'F3', 'F4', 'C3', 'C4'] },
      notch_filter: { freqs: [50, 100], n_freqs: 2 },
      bandpass_filter: { low: 0.5, high: 50 },
      artifact_detection: { n_artifacts: 3, by_type: { eog: 2, emg: 1 } },
    },
    artifacts: [
      {
        start_time: 10.5,
        end_time: 11.2,
        artifact_type: 'eog',
        channel: 'Fp1',
        severity: 0.85,
        description: 'EOG 伪迹（幅值 > 75 µV）',
      },
      {
        start_time: 25.0,
        end_time: 25.5,
        artifact_type: 'emg',
        channel: 'F3',
        severity: 0.62,
        description: 'EMG 伪迹（RMS > 50 µV）',
      },
      {
        start_time: 45.0,
        end_time: 46.0,
        artifact_type: 'eog',
        channel: 'Fp2',
        severity: 0.78,
        description: 'EOG 伪迹（幅值 > 75 µV）',
      },
    ],
    artifact_summary: {
      eog: 2,
      emg: 1,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('渲染', () => {
    it('当 fileId 为 null 时显示空状态提示', () => {
      render(<AutoPreprocessPanel fileId={null} channelNames={[]} />);

      expect(screen.getByText('请先加载 EDF 文件')).toBeInTheDocument();
    });

    it('显示面板标题', () => {
      render(<AutoPreprocessPanel {...defaultProps} />);

      expect(screen.getByText('自动预处理')).toBeInTheDocument();
    });

    it('显示通道数量信息', () => {
      render(<AutoPreprocessPanel {...defaultProps} />);

      expect(screen.getByText(/6 个通道/)).toBeInTheDocument();
    });
  });

  describe('配置选项', () => {
    it('显示重参考选择器', () => {
      render(<AutoPreprocessPanel {...defaultProps} />);

      expect(screen.getByText('重参考:')).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /重参考/ })).toBeInTheDocument();
    });

    it('显示 Notch 滤波开关', () => {
      render(<AutoPreprocessPanel {...defaultProps} />);

      expect(screen.getByText('Notch 滤波 (50Hz)')).toBeInTheDocument();
    });

    it('显示带通滤波配置', () => {
      render(<AutoPreprocessPanel {...defaultProps} />);

      expect(screen.getByText('带通滤波')).toBeInTheDocument();
      expect(screen.getByLabelText(/低截止/)).toBeInTheDocument();
      expect(screen.getByLabelText(/高截止/)).toBeInTheDocument();
    });

    it('显示伪迹检测开关', () => {
      render(<AutoPreprocessPanel {...defaultProps} />);

      expect(screen.getByText('伪迹检测')).toBeInTheDocument();
    });

    it('显示执行按钮', () => {
      render(<AutoPreprocessPanel {...defaultProps} />);

      expect(screen.getByRole('button', { name: '执行预处理' })).toBeInTheDocument();
    });
  });

  describe('配置交互', () => {
    it('切换重参考类型', async () => {
      render(<AutoPreprocessPanel {...defaultProps} />);

      const select = screen.getByRole('combobox', { name: /重参考/ });
      await userEvent.selectOptions(select, 'linked-mastoid');

      expect(select).toHaveValue('linked-mastoid');
    });

    it('切换 Notch 滤波开关', async () => {
      render(<AutoPreprocessPanel {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox', { name: /Notch 滤波/ });
      expect(checkbox).toBeChecked();

      await userEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });

    it('修改带通滤波频率', async () => {
      render(<AutoPreprocessPanel {...defaultProps} />);

      const lowInput = screen.getByLabelText(/低截止/);
      const highInput = screen.getByLabelText(/高截止/);

      await userEvent.clear(lowInput);
      await userEvent.type(lowInput, '1');

      await userEvent.clear(highInput);
      await userEvent.type(highInput, '45');

      expect(lowInput).toHaveValue(1);
      expect(highInput).toHaveValue(45);
    });

    it('切换伪迹检测开关', async () => {
      render(<AutoPreprocessPanel {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox', { name: /伪迹检测/ });
      expect(checkbox).toBeChecked();

      await userEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });
  });

  describe('执行预处理', () => {
    it('点击执行按钮调用 API', async () => {
      (runAutoPreprocess as any).mockResolvedValue(mockPreprocessResponse);

      render(<AutoPreprocessPanel {...defaultProps} />);

      const button = screen.getByRole('button', { name: '执行预处理' });
      await userEvent.click(button);

      await waitFor(() => {
        expect(runAutoPreprocess).toHaveBeenCalledWith('test-file-id', expect.any(Object));
      });
    });

    it('执行中显示加载状态', async () => {
      (runAutoPreprocess as any).mockImplementation(() => new Promise(() => {})); // 永远 pending

      render(<AutoPreprocessPanel {...defaultProps} />);

      const button = screen.getByRole('button', { name: '执行预处理' });
      await userEvent.click(button);

      expect(screen.getByText('处理中...')).toBeInTheDocument();
      expect(button).toBeDisabled();
    });

    it('执行成功后显示结果', async () => {
      (runAutoPreprocess as any).mockResolvedValue(mockPreprocessResponse);

      render(<AutoPreprocessPanel {...defaultProps} />);

      const button = screen.getByRole('button', { name: '执行预处理' });
      await userEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/预处理完成/)).toBeInTheDocument();
      });
    });

    it('执行失败显示错误信息', async () => {
      (runAutoPreprocess as any).mockRejectedValue(new Error('预处理失败'));

      render(<AutoPreprocessPanel {...defaultProps} />);

      const button = screen.getByRole('button', { name: '执行预处理' });
      await userEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('预处理失败')).toBeInTheDocument();
      });
    });
  });

  describe('结果展示', () => {
    it('显示处理时间', async () => {
      (runAutoPreprocess as any).mockResolvedValue(mockPreprocessResponse);

      render(<AutoPreprocessPanel {...defaultProps} />);

      const button = screen.getByRole('button', { name: '执行预处理' });
      await userEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/5.23 秒/)).toBeInTheDocument();
      });
    });

    it('显示伪迹摘要', async () => {
      (runAutoPreprocess as any).mockResolvedValue(mockPreprocessResponse);

      render(<AutoPreprocessPanel {...defaultProps} />);

      const button = screen.getByRole('button', { name: '执行预处理' });
      await userEvent.click(button);

      await waitFor(() => {
        // 组件显示中文标签
        expect(screen.getByText('眼电伪迹: 2')).toBeInTheDocument();
        expect(screen.getByText('肌电伪迹: 1')).toBeInTheDocument();
      });
    });

    it('显示伪迹详情列表', async () => {
      (runAutoPreprocess as any).mockResolvedValue(mockPreprocessResponse);

      render(<AutoPreprocessPanel {...defaultProps} />);

      const button = screen.getByRole('button', { name: '执行预处理' });
      await userEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Fp1')).toBeInTheDocument();
        expect(screen.getByText(/10.5s - 11.2s/)).toBeInTheDocument();
      });
    });

    it('显示通道类型识别结果', async () => {
      (runAutoPreprocess as any).mockResolvedValue(mockPreprocessResponse);

      render(<AutoPreprocessPanel {...defaultProps} />);

      const button = screen.getByRole('button', { name: '执行预处理' });
      await userEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('通道类型')).toBeInTheDocument();
        expect(screen.getByText(/EEG: 6/)).toBeInTheDocument();
      });
    });

    it('无伪迹时显示提示', async () => {
      const noArtifactResponse = {
        ...mockPreprocessResponse,
        artifacts: [],
        artifact_summary: {},
      };
      (runAutoPreprocess as any).mockResolvedValue(noArtifactResponse);

      render(<AutoPreprocessPanel {...defaultProps} />);

      const button = screen.getByRole('button', { name: '执行预处理' });
      await userEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('未检测到伪迹')).toBeInTheDocument();
      });
    });
  });

  describe('重置功能', () => {
    it('点击重置按钮清除结果', async () => {
      (runAutoPreprocess as any).mockResolvedValue(mockPreprocessResponse);

      render(<AutoPreprocessPanel {...defaultProps} />);

      // 先执行
      const button = screen.getByRole('button', { name: '执行预处理' });
      await userEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/预处理完成/)).toBeInTheDocument();
      });

      // 点击重置
      const resetButton = screen.getByRole('button', { name: '重置' });
      await userEvent.click(resetButton);

      expect(screen.queryByText(/预处理完成/)).not.toBeInTheDocument();
    });
  });

  describe('可选分析', () => {
    it('显示频段分析选项', () => {
      render(<AutoPreprocessPanel {...defaultProps} />);

      expect(screen.getByText('频段分析')).toBeInTheDocument();
    });

    it('显示异常检测选项', () => {
      render(<AutoPreprocessPanel {...defaultProps} />);

      expect(screen.getByText('异常检测')).toBeInTheDocument();
    });

    it('勾选异常检测时显示灵敏度选项', async () => {
      render(<AutoPreprocessPanel {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox', { name: /异常检测/ });
      await userEvent.click(checkbox);

      expect(screen.getByLabelText(/灵敏度/)).toBeInTheDocument();
    });
  });
});
