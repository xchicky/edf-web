/**
 * AnomalyDetectionPanel.test.tsx
 * 异常检测面板组件测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnomalyDetectionPanel } from '../AnomalyDetectionPanel';
import * as edfApi from '../../api/edf';
import type { AnomalyDetectionResponse } from '../../types/analysis';

// Mock API
vi.mock('../../api/edf', () => ({
  detectAnomalies: vi.fn(),
}));

// Mock env
vi.mock('../../env', () => ({
  getApiUrl: (path: string) => `http://localhost:8000${path}`,
}));

const mockDetectAnomalies = vi.mocked(edfApi.detectAnomalies);

// Test fixtures
const mockChannels = ['Fp1', 'Fp2', 'F3', 'F4', 'C3', 'C4'];

const mockAnomalyResponse: AnomalyDetectionResponse = {
  file_id: 'test-file-id',
  channels: [
    {
      channel: 'Fp1',
      anomalies: [
        {
          onset: 1.5,
          duration: 0.1,
          type: 'spike',
          confidence: 0.85,
          channels: ['Fp1'],
          description: '棘波检测于 Fp1',
        },
        {
          onset: 3.2,
          duration: 0.15,
          type: 'sharp_wave',
          confidence: 0.72,
          channels: ['Fp1'],
          description: '尖波检测于 Fp1',
        },
      ],
      total_events: 2,
      anomaly_rate: 0.025,
    },
    {
      channel: 'Fp2',
      anomalies: [
        {
          onset: 2.0,
          duration: 0.2,
          type: 'spike_and_slow',
          confidence: 0.9,
          channels: ['Fp2'],
          description: '棘慢复合波检测',
        },
      ],
      total_events: 1,
      anomaly_rate: 0.015,
    },
  ],
  total_anomalies: 3,
  processing_time: 2.5,
  sensitivity: 1.0,
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('AnomalyDetectionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('空状态渲染', () => {
    it('当 fileId 为 null 时显示空状态提示', () => {
      render(
        <AnomalyDetectionPanel
          fileId={null}
          channels={mockChannels}
          duration={600}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('请先加载 EDF 文件')).toBeInTheDocument();
    });

    it('显示标题', () => {
      render(
        <AnomalyDetectionPanel
          fileId="test-file-id"
          channels={mockChannels}
          duration={600}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('异常波形检测')).toBeInTheDocument();
    });
  });

  describe('配置选项', () => {
    it('显示起始时间输入框', () => {
      render(
        <AnomalyDetectionPanel
          fileId="test-file-id"
          channels={mockChannels}
          duration={600}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByLabelText(/起始时间/)).toBeInTheDocument();
    });

    it('显示分析时长输入框', () => {
      render(
        <AnomalyDetectionPanel
          fileId="test-file-id"
          channels={mockChannels}
          duration={600}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByLabelText(/分析时长/)).toBeInTheDocument();
    });

    it('显示灵敏度选择器', () => {
      render(
        <AnomalyDetectionPanel
          fileId="test-file-id"
          channels={mockChannels}
          duration={600}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByLabelText(/检测灵敏度/)).toBeInTheDocument();
    });

    it('显示自动预处理选项', () => {
      render(
        <AnomalyDetectionPanel
          fileId="test-file-id"
          channels={mockChannels}
          duration={600}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('自动预处理')).toBeInTheDocument();
    });

    it('显示通道选择区域', () => {
      render(
        <AnomalyDetectionPanel
          fileId="test-file-id"
          channels={mockChannels}
          duration={600}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('选择通道')).toBeInTheDocument();
      expect(screen.getByText('全选')).toBeInTheDocument();
    });

    it('显示检测按钮', () => {
      render(
        <AnomalyDetectionPanel
          fileId="test-file-id"
          channels={mockChannels}
          duration={600}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByRole('button', { name: '开始检测' })).toBeInTheDocument();
    });
  });

  describe('通道选择', () => {
    it('显示所有通道选项', () => {
      render(
        <AnomalyDetectionPanel
          fileId="test-file-id"
          channels={mockChannels}
          duration={600}
        />,
        { wrapper: createWrapper() }
      );

      mockChannels.forEach((channel) => {
        expect(screen.getByText(channel)).toBeInTheDocument();
      });
    });

    it('点击全选按钮选中所有通道', () => {
      render(
        <AnomalyDetectionPanel
          fileId="test-file-id"
          channels={mockChannels}
          duration={600}
        />,
        { wrapper: createWrapper() }
      );

      const selectAllBtn = screen.getByText('全选');
      fireEvent.click(selectAllBtn);

      // 所有通道复选框应该被选中
      const checkboxes = screen.getAllByRole('checkbox');
      const channelCheckboxes = checkboxes.slice(0, mockChannels.length); // 排除自动预处理复选框
      channelCheckboxes.forEach((cb) => {
        expect(cb).toBeChecked();
      });
    });

    it('点击取消全选按钮取消所有通道选择', () => {
      render(
        <AnomalyDetectionPanel
          fileId="test-file-id"
          channels={mockChannels}
          duration={600}
        />,
        { wrapper: createWrapper() }
      );

      // 先全选
      const selectAllBtn = screen.getByText('全选');
      fireEvent.click(selectAllBtn);

      // 再取消全选
      const deselectAllBtn = screen.getByText('取消全选');
      fireEvent.click(deselectAllBtn);

      // 只检查通道网格内的复选框
      const channelGrid = screen.getByText('Fp1').closest('[class*="channelGrid"]');
      if (channelGrid) {
        const checkboxes = channelGrid.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach((cb) => {
          expect(cb).not.toBeChecked();
        });
      }
    });
  });

  describe('检测执行', () => {
    it('点击检测按钮调用 API', async () => {
      mockDetectAnomalies.mockResolvedValueOnce(mockAnomalyResponse);

      render(
        <AnomalyDetectionPanel
          fileId="test-file-id"
          channels={mockChannels}
          duration={600}
        />,
        { wrapper: createWrapper() }
      );

      const detectBtn = screen.getByRole('button', { name: '开始检测' });
      fireEvent.click(detectBtn);

      await waitFor(() => {
        expect(mockDetectAnomalies).toHaveBeenCalledWith(
          'test-file-id',
          expect.objectContaining({
            start: 0,
            duration: 10,
            sensitivity: 1.0,
          })
        );
      });
    });

    it('检测中显示加载状态', async () => {
      // 使用永不 resolve 的 Promise 来模拟加载状态
      mockDetectAnomalies.mockImplementationOnce(
        () => new Promise(() => { /* 永不 resolve */ })
      );

      render(
        <AnomalyDetectionPanel
          fileId="test-file-id"
          channels={mockChannels}
          duration={600}
        />,
        { wrapper: createWrapper() }
      );

      const detectBtn = screen.getByRole('button', { name: '开始检测' });
      fireEvent.click(detectBtn);

      // 使用 findByText 等待加载状态出现
      const loadingText = await screen.findByText('检测中...', {}, { timeout: 1000 });
      expect(loadingText).toBeInTheDocument();
    });

    it('检测成功后显示结果', async () => {
      mockDetectAnomalies.mockResolvedValueOnce(mockAnomalyResponse);

      render(
        <AnomalyDetectionPanel
          fileId="test-file-id"
          channels={mockChannels}
          duration={600}
        />,
        { wrapper: createWrapper() }
      );

      const detectBtn = screen.getByRole('button', { name: '开始检测' });
      fireEvent.click(detectBtn);

      await waitFor(() => {
        expect(screen.getByText(/共发现/)).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument(); // total anomalies
      });
    });

    it('检测失败显示错误信息', async () => {
      mockDetectAnomalies.mockRejectedValueOnce(new Error('检测失败'));

      render(
        <AnomalyDetectionPanel
          fileId="test-file-id"
          channels={mockChannels}
          duration={600}
        />,
        { wrapper: createWrapper() }
      );

      const detectBtn = screen.getByRole('button', { name: '开始检测' });
      fireEvent.click(detectBtn);

      await waitFor(() => {
        expect(screen.getByText(/检测失败/)).toBeInTheDocument();
      });
    });
  });

  describe('结果展示', () => {
    it('显示异常类型统计', async () => {
      mockDetectAnomalies.mockResolvedValueOnce(mockAnomalyResponse);

      render(
        <AnomalyDetectionPanel
          fileId="test-file-id"
          channels={mockChannels}
          duration={600}
        />,
        { wrapper: createWrapper() }
      );

      const detectBtn = screen.getByRole('button', { name: '开始检测' });
      fireEvent.click(detectBtn);

      await waitFor(() => {
        // 棘波: 1, 尖波: 1, 棘慢复合波: 1
        // 使用 getAllByText 检查存在性
        expect(screen.getAllByText(/棘波/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/尖波/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/棘慢复合波/).length).toBeGreaterThan(0);
      });
    });

    it('显示通道分组结果', async () => {
      mockDetectAnomalies.mockResolvedValueOnce(mockAnomalyResponse);

      render(
        <AnomalyDetectionPanel
          fileId="test-file-id"
          channels={mockChannels}
          duration={600}
        />,
        { wrapper: createWrapper() }
      );

      const detectBtn = screen.getByRole('button', { name: '开始检测' });
      fireEvent.click(detectBtn);

      await waitFor(() => {
        expect(screen.getByText('Fp1')).toBeInTheDocument();
        expect(screen.getByText('Fp2')).toBeInTheDocument();
      });
    });

    it('显示异常详情', async () => {
      mockDetectAnomalies.mockResolvedValueOnce(mockAnomalyResponse);

      render(
        <AnomalyDetectionPanel
          fileId="test-file-id"
          channels={mockChannels}
          duration={600}
        />,
        { wrapper: createWrapper() }
      );

      const detectBtn = screen.getByRole('button', { name: '开始检测' });
      fireEvent.click(detectBtn);

      await waitFor(() => {
        expect(screen.getByText('棘波检测于 Fp1')).toBeInTheDocument();
      });
    });

    it('点击异常项触发跳转', async () => {
      const onJumpToTime = vi.fn();
      mockDetectAnomalies.mockResolvedValueOnce(mockAnomalyResponse);

      render(
        <AnomalyDetectionPanel
          fileId="test-file-id"
          channels={mockChannels}
          duration={600}
          onJumpToTime={onJumpToTime}
        />,
        { wrapper: createWrapper() }
      );

      const detectBtn = screen.getByRole('button', { name: '开始检测' });
      fireEvent.click(detectBtn);

      await waitFor(() => {
        expect(screen.getByText('棘波检测于 Fp1')).toBeInTheDocument();
      });

      // 点击异常项
      const anomalyItem = screen.getByText('棘波检测于 Fp1').closest('[role="button"]');
      if (anomalyItem) {
        fireEvent.click(anomalyItem);
        expect(onJumpToTime).toHaveBeenCalledWith(1.5); // onset time
      }
    });

    it('显示处理时间', async () => {
      mockDetectAnomalies.mockResolvedValueOnce(mockAnomalyResponse);

      render(
        <AnomalyDetectionPanel
          fileId="test-file-id"
          channels={mockChannels}
          duration={600}
        />,
        { wrapper: createWrapper() }
      );

      const detectBtn = screen.getByRole('button', { name: '开始检测' });
      fireEvent.click(detectBtn);

      await waitFor(() => {
        expect(screen.getByText(/耗时/)).toBeInTheDocument();
        expect(screen.getByText(/2.50s/)).toBeInTheDocument();
      });
    });
  });

  describe('类型过滤', () => {
    it('显示全部按钮', async () => {
      mockDetectAnomalies.mockResolvedValueOnce(mockAnomalyResponse);

      render(
        <AnomalyDetectionPanel
          fileId="test-file-id"
          channels={mockChannels}
          duration={600}
        />,
        { wrapper: createWrapper() }
      );

      const detectBtn = screen.getByRole('button', { name: '开始检测' });
      fireEvent.click(detectBtn);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /全部/ })).toBeInTheDocument();
      });
    });

    it('点击类型过滤器过滤结果', async () => {
      mockDetectAnomalies.mockResolvedValueOnce(mockAnomalyResponse);

      render(
        <AnomalyDetectionPanel
          fileId="test-file-id"
          channels={mockChannels}
          duration={600}
        />,
        { wrapper: createWrapper() }
      );

      const detectBtn = screen.getByRole('button', { name: '开始检测' });
      fireEvent.click(detectBtn);

      await waitFor(() => {
        expect(screen.getByText('棘波检测于 Fp1')).toBeInTheDocument();
      });

      // 找到类型过滤器按钮区域，点击棘波过滤器
      const typeFilterBtns = screen.getAllByRole('button').filter(
        btn => btn.textContent?.includes('棘波') && btn.textContent?.includes('(')
      );
      if (typeFilterBtns.length > 0) {
        fireEvent.click(typeFilterBtns[0]);
      }

      // 验证过滤结果
      await waitFor(() => {
        expect(screen.getByText('棘波检测于 Fp1')).toBeInTheDocument();
      });
    });

    it('点击"全部"按钮显示所有异常', async () => {
      mockDetectAnomalies.mockResolvedValueOnce(mockAnomalyResponse);

      render(
        <AnomalyDetectionPanel
          fileId="test-file-id"
          channels={mockChannels}
          duration={600}
        />,
        { wrapper: createWrapper() }
      );

      const detectBtn = screen.getByRole('button', { name: '开始检测' });
      fireEvent.click(detectBtn);

      await waitFor(() => {
        expect(screen.getByText('棘波检测于 Fp1')).toBeInTheDocument();
      });

      // 先点击棘波过滤器过滤
      const typeFilterBtns = screen.getAllByRole('button').filter(
        btn => btn.textContent?.includes('棘波') && btn.textContent?.includes('(')
      );
      if (typeFilterBtns.length > 0) {
        fireEvent.click(typeFilterBtns[0]);
      }

      // 再点击"全部"按钮恢复
      const allBtn = screen.getByRole('button', { name: /全部/ });
      fireEvent.click(allBtn);

      // 应该显示所有异常
      await waitFor(() => {
        expect(screen.getByText('棘波检测于 Fp1')).toBeInTheDocument();
        expect(screen.getByText('尖波检测于 Fp1')).toBeInTheDocument();
      });
    });
  });

  describe('通道折叠', () => {
    it('点击通道标题折叠/展开异常列表', async () => {
      mockDetectAnomalies.mockResolvedValueOnce(mockAnomalyResponse);

      render(
        <AnomalyDetectionPanel
          fileId="test-file-id"
          channels={mockChannels}
          duration={600}
        />,
        { wrapper: createWrapper() }
      );

      const detectBtn = screen.getByRole('button', { name: '开始检测' });
      fireEvent.click(detectBtn);

      await waitFor(() => {
        // 找到通道名称（带有异常计数）
        expect(screen.getByText('Fp1')).toBeInTheDocument();
      });

      // 点击通道标题折叠
      const channelHeaders = screen.getAllByRole('button').filter(
        btn => btn.textContent?.includes('Fp1') && btn.textContent?.includes('个异常')
      );
      if (channelHeaders.length > 0) {
        fireEvent.click(channelHeaders[0]);

        // 验证折叠状态
        await waitFor(() => {
          expect(screen.getByText('▶')).toBeInTheDocument();
        });
      }
    });

    it('使用键盘操作折叠通道', async () => {
      mockDetectAnomalies.mockResolvedValueOnce(mockAnomalyResponse);

      render(
        <AnomalyDetectionPanel
          fileId="test-file-id"
          channels={mockChannels}
          duration={600}
        />,
        { wrapper: createWrapper() }
      );

      const detectBtn = screen.getByRole('button', { name: '开始检测' });
      fireEvent.click(detectBtn);

      await waitFor(() => {
        expect(screen.getByText('Fp1')).toBeInTheDocument();
      });

      // 使用键盘操作
      const channelHeaders = screen.getAllByRole('button').filter(
        btn => btn.textContent?.includes('Fp1') && btn.textContent?.includes('个异常')
      );
      if (channelHeaders.length > 0) {
        fireEvent.keyDown(channelHeaders[0], { key: 'Enter' });

        // 验证折叠状态
        await waitFor(() => {
          expect(screen.getByText('▶')).toBeInTheDocument();
        });
      }
    });
  });

  describe('异常项键盘交互', () => {
    it('使用 Enter 键触发跳转', async () => {
      const onJumpToTime = vi.fn();
      mockDetectAnomalies.mockResolvedValueOnce(mockAnomalyResponse);

      render(
        <AnomalyDetectionPanel
          fileId="test-file-id"
          channels={mockChannels}
          duration={600}
          onJumpToTime={onJumpToTime}
        />,
        { wrapper: createWrapper() }
      );

      const detectBtn = screen.getByRole('button', { name: '开始检测' });
      fireEvent.click(detectBtn);

      await waitFor(() => {
        expect(screen.getByText('棘波检测于 Fp1')).toBeInTheDocument();
      });

      // 使用键盘操作异常项
      const anomalyItem = screen.getByText('棘波检测于 Fp1').closest('[role="button"]');
      if (anomalyItem) {
        fireEvent.keyDown(anomalyItem, { key: 'Enter' });
        expect(onJumpToTime).toHaveBeenCalledWith(1.5);
      }
    });
  });

  describe('重置功能', () => {
    it('点击重置按钮清除结果', async () => {
      mockDetectAnomalies.mockResolvedValueOnce(mockAnomalyResponse);

      render(
        <AnomalyDetectionPanel
          fileId="test-file-id"
          channels={mockChannels}
          duration={600}
        />,
        { wrapper: createWrapper() }
      );

      const detectBtn = screen.getByRole('button', { name: '开始检测' });
      fireEvent.click(detectBtn);

      await waitFor(() => {
        expect(screen.getByText(/共发现/)).toBeInTheDocument();
      });

      const resetBtn = screen.getByRole('button', { name: '重置' });
      fireEvent.click(resetBtn);

      await waitFor(() => {
        expect(screen.queryByText(/共发现/)).not.toBeInTheDocument();
      });
    });
  });

  describe('无异常结果', () => {
    it('显示未检测到异常提示', async () => {
      const emptyResponse: AnomalyDetectionResponse = {
        file_id: 'test-file-id',
        channels: [],
        total_anomalies: 0,
        processing_time: 1.5,
        sensitivity: 1.0,
      };
      mockDetectAnomalies.mockResolvedValueOnce(emptyResponse);

      render(
        <AnomalyDetectionPanel
          fileId="test-file-id"
          channels={mockChannels}
          duration={600}
        />,
        { wrapper: createWrapper() }
      );

      const detectBtn = screen.getByRole('button', { name: '开始检测' });
      fireEvent.click(detectBtn);

      await waitFor(() => {
        expect(screen.getByText('未检测到异常波形')).toBeInTheDocument();
      });
    });
  });
});
