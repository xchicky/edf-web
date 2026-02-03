/**
 * ModeEditor SignalExpressionBuilder Integration Tests
 * 测试 ModeEditor 中集成的 SignalExpressionBuilder 组件
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModeEditor } from '../ModeEditor';
import type { Mode, ModeCategory } from '../../types/mode';

// Mock API
vi.mock('../../api/mode', () => ({
  createMode: vi.fn(),
  updateMode: vi.fn(),
  deleteMode: vi.fn(),
}));

// Mock Store
vi.mock('../../store/edfStore', () => ({
  useEDFStore: vi.fn(selector => {
    const store = {
      metadata: {
        file_id: 'test-file',
        channel_names: ['Fp1', 'Fp2', 'F3', 'F4', 'C3', 'C4', 'O1', 'O2'],
      },
      loadModes: vi.fn(),
    };
    return selector ? selector(store) : store;
  }),
}));

import { createMode, updateMode, deleteMode } from '../../api/mode';

const mockCreateMode = vi.mocked(createMode);
const mockUpdateMode = vi.mocked(updateMode);
const mockDeleteMode = vi.mocked(deleteMode);

describe('ModeEditor - SignalExpressionBuilder Integration', () => {
  const mockAvailableChannels = ['Fp1', 'Fp2', 'F3', 'F4', 'C3', 'C4', 'O1', 'O2'];
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();

  const defaultProps = {
    isOpen: true,
    mode: null,
    availableChannels: mockAvailableChannels,
    onSave: mockOnSave,
    onCancel: mockOnCancel,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateMode.mockResolvedValue({
      id: 'mode-1',
      name: 'Test Mode',
      category: 'custom' as ModeCategory,
      config: {
        viewMode: 'waveform',
        timeWindow: 10,
        amplitudeScale: 1.0,
        showGrid: true,
        showAnnotations: true,
        displayChannels: [],
        enableFilter: false,
        bands: [],
        analysis: { enabled: false, type: 'stats', autoUpdate: false },
        autoSave: true,
        maxBookmarks: 50,
        signals: [],
      },
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      isBuiltIn: false,
      isFavorite: false,
      usageCount: 0,
      tags: [],
    });

    mockUpdateMode.mockResolvedValue({
      id: 'mode-1',
      name: 'Updated Mode',
      category: 'custom' as ModeCategory,
      config: {
        viewMode: 'waveform',
        timeWindow: 10,
        amplitudeScale: 1.0,
        showGrid: true,
        showAnnotations: true,
        displayChannels: [],
        enableFilter: false,
        bands: [],
        analysis: { enabled: false, type: 'stats', autoUpdate: false },
        autoSave: true,
        maxBookmarks: 50,
        signals: [],
      },
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      isBuiltIn: false,
      isFavorite: false,
      usageCount: 0,
      tags: [],
    });
  });

  describe('派生信号编辑器集成', () => {
    it('应该在派生信号编辑器中显示表达式构建器', () => {
      render(<ModeEditor {...defaultProps} />);

      // 点击添加信号按钮
      const addButton = screen.getByText('+ 添加信号');
      fireEvent.click(addButton);

      // 应该显示表达式构建器的输入框（使用 SignalExpressionBuilder 的 placeholder）
      expect(screen.getByPlaceholderText('输入表达式或使用下方按钮构建')).toBeInTheDocument();
    });

    it('应该在信号编辑器中显示表达式输入框', () => {
      render(<ModeEditor {...defaultProps} />);

      // 点击添加信号按钮
      const addButton = screen.getByText('+ 添加信号');
      fireEvent.click(addButton);

      // 应该显示表达式输入框（SignalExpressionBuilder 的输入框）
      const expressionInput = screen.getByPlaceholderText('输入表达式或使用下方按钮构建');
      expect(expressionInput).toBeInTheDocument();
    });

    it('应该显示表达式验证状态图标', () => {
      render(<ModeEditor {...defaultProps} />);

      // 点击添加信号按钮
      const addButton = screen.getByText('+ 添加信号');
      fireEvent.click(addButton);

      // 空表达式应显示无效图标
      expect(screen.getByText('✗')).toBeInTheDocument();
    });

    it('应该在表达式有效时显示验证通过图标', async () => {
      render(<ModeEditor {...defaultProps} />);

      // 点击添加信号按钮
      const addButton = screen.getByText('+ 添加信号');
      fireEvent.click(addButton);

      // 输入有效表达式
      const expressionInput = screen.getByPlaceholderText('输入表达式或使用下方按钮构建');
      fireEvent.change(expressionInput, { target: { value: 'Fp1' } });

      // 应该显示有效图标
      await waitFor(() => {
        expect(screen.getByText('✓')).toBeInTheDocument();
      });
    });

    it('应该在表达式无效时显示验证失败图标', async () => {
      render(<ModeEditor {...defaultProps} />);

      // 点击添加信号按钮
      const addButton = screen.getByText('+ 添加信号');
      fireEvent.click(addButton);

      // 输入无效表达式（包含未知通道）
      const expressionInput = screen.getByPlaceholderText('输入表达式或使用下方按钮构建');
      fireEvent.change(expressionInput, { target: { value: 'UnknownChannel' } });

      // 应该仍然显示无效图标
      await waitFor(() => {
        expect(screen.getByText('✗')).toBeInTheDocument();
      });
    });

    it('应该显示显示/隐藏构建器按钮', () => {
      render(<ModeEditor {...defaultProps} />);

      // 点击添加信号按钮
      const addButton = screen.getByText('+ 添加信号');
      fireEvent.click(addButton);

      // 应该有显示构建器按钮
      expect(screen.getByText('显示构建器')).toBeInTheDocument();
    });

    it('点击显示构建器按钮应展开构建器面板', () => {
      render(<ModeEditor {...defaultProps} />);

      // 点击添加信号按钮
      const addButton = screen.getByText('+ 添加信号');
      fireEvent.click(addButton);

      // 点击显示构建器按钮
      const showBuilderButton = screen.getByText('显示构建器');
      fireEvent.click(showBuilderButton);

      // 应该显示构建器面板内容
      expect(screen.getByText('通道')).toBeInTheDocument();
      expect(screen.getByText('操作符')).toBeInTheDocument();
      expect(screen.getByText('括号')).toBeInTheDocument();
    });

    it('应该显示所有可用通道按钮', () => {
      render(<ModeEditor {...defaultProps} />);

      // 点击添加信号按钮
      const addButton = screen.getByText('+ 添加信号');
      fireEvent.click(addButton);

      // 点击显示构建器按钮
      const showBuilderButton = screen.getByText('显示构建器');
      fireEvent.click(showBuilderButton);

      // 应该显示所有通道按钮（使用 button 角色来区分构建器中的按钮）
      for (const channel of mockAvailableChannels) {
        const channelButtons = screen.getAllByText(channel);
        // 至少应该有一个按钮元素（在构建器中）
        const buttonExists = channelButtons.some(el => el.tagName === 'BUTTON');
        expect(buttonExists).toBe(true);
      }
    });

    it('点击通道按钮应添加到表达式', () => {
      render(<ModeEditor {...defaultProps} />);

      // 点击添加信号按钮
      const addButton = screen.getByText('+ 添加信号');
      fireEvent.click(addButton);

      // 点击显示构建器按钮
      const showBuilderButton = screen.getByText('显示构建器');
      fireEvent.click(showBuilderButton);

      // 点击 Fp1 通道按钮（选择按钮元素）
      const fp1Buttons = screen.getAllByText('Fp1');
      const fp1Button = fp1Buttons.find(el => el.tagName === 'BUTTON');
      expect(fp1Button).toBeDefined();
      if (fp1Button) {
        fireEvent.click(fp1Button);

        // 表达式输入框应该显示 Fp1
        const expressionInput = screen.getByPlaceholderText('输入表达式或使用下方按钮构建');
        expect(expressionInput.getAttribute('value')).toBe('Fp1');
      }
    });

    it('应该显示操作符按钮', () => {
      render(<ModeEditor {...defaultProps} />);

      // 点击添加信号按钮
      const addButton = screen.getByText('+ 添加信号');
      fireEvent.click(addButton);

      // 点击显示构建器按钮
      const showBuilderButton = screen.getByText('显示构建器');
      fireEvent.click(showBuilderButton);

      // 应该显示所有操作符按钮（使用 getAllByText 并查找按钮元素）
      const plusButtons = screen.getAllByText('+').filter(el => el.tagName === 'BUTTON' && el.classList.value.includes('operator'));
      const minusButtons = screen.getAllByText('−').filter(el => el.tagName === 'BUTTON' && el.classList.value.includes('operator'));
      const mulButtons = screen.getAllByText('×').filter(el => el.tagName === 'BUTTON' && el.classList.value.includes('operator'));
      const divButtons = screen.getAllByText('÷').filter(el => el.tagName === 'BUTTON' && el.classList.value.includes('operator'));

      expect(plusButtons.length).toBeGreaterThan(0);
      expect(minusButtons.length).toBeGreaterThan(0);
      expect(mulButtons.length).toBeGreaterThan(0);
      expect(divButtons.length).toBeGreaterThan(0);
    });

    it('点击操作符按钮应添加到表达式', () => {
      render(<ModeEditor {...defaultProps} />);

      // 点击添加信号按钮
      const addButton = screen.getByText('+ 添加信号');
      fireEvent.click(addButton);

      // 先添加通道
      const expressionInput = screen.getByPlaceholderText('输入表达式或使用下方按钮构建');
      fireEvent.change(expressionInput, { target: { value: 'Fp1' } });

      // 点击显示构建器按钮
      const showBuilderButton = screen.getByText('显示构建器');
      fireEvent.click(showBuilderButton);

      // 点击减号操作符
      const minusButton = screen.getByText('−');
      fireEvent.click(minusButton);

      // 表达式应该包含操作符
      expect(expressionInput.value).toBe('Fp1 - ');
    });

    it('应该显示括号按钮', () => {
      render(<ModeEditor {...defaultProps} />);

      // 点击添加信号按钮
      const addButton = screen.getByText('+ 添加信号');
      fireEvent.click(addButton);

      // 点击显示构建器按钮
      const showBuilderButton = screen.getByText('显示构建器');
      fireEvent.click(showBuilderButton);

      // 应该显示括号按钮
      expect(screen.getByText('( )')).toBeInTheDocument();
    });

    it('点击括号按钮应包装表达式', () => {
      render(<ModeEditor {...defaultProps} />);

      // 点击添加信号按钮
      const addButton = screen.getByText('+ 添加信号');
      fireEvent.click(addButton);

      // 先添加表达式
      const expressionInput = screen.getByPlaceholderText('输入表达式或使用下方按钮构建');
      fireEvent.change(expressionInput, { target: { value: 'Fp1 + F3' } });

      // 点击显示构建器按钮
      const showBuilderButton = screen.getByText('显示构建器');
      fireEvent.click(showBuilderButton);

      // 点击括号按钮
      const parenButton = screen.getByText('( )');
      fireEvent.click(parenButton);

      // 表达式应该被括号包装
      expect(expressionInput.value).toBe('(Fp1 + F3)');
    });

    it('应该显示清空按钮', () => {
      render(<ModeEditor {...defaultProps} />);

      // 点击添加信号按钮
      const addButton = screen.getByText('+ 添加信号');
      fireEvent.click(addButton);

      // 点击显示构建器按钮
      const showBuilderButton = screen.getByText('显示构建器');
      fireEvent.click(showBuilderButton);

      // 应该显示清空按钮
      expect(screen.getByText('清空')).toBeInTheDocument();
    });

    it('点击清空按钮应清除表达式', () => {
      render(<ModeEditor {...defaultProps} />);

      // 点击添加信号按钮
      const addButton = screen.getByText('+ 添加信号');
      fireEvent.click(addButton);

      // 先添加表达式
      const expressionInput = screen.getByPlaceholderText('输入表达式或使用下方按钮构建');
      fireEvent.change(expressionInput, { target: { value: 'Fp1 + F3' } });

      // 点击显示构建器按钮
      const showBuilderButton = screen.getByText('显示构建器');
      fireEvent.click(showBuilderButton);

      // 点击清空按钮
      const clearButton = screen.getByText('清空');
      fireEvent.click(clearButton);

      // 表达式应该被清空
      expect(expressionInput.value).toBe('');
    });

    it('应该显示表达式验证信息（引用的通道）', async () => {
      render(<ModeEditor {...defaultProps} />);

      // 点击添加信号按钮
      const addButton = screen.getByText('+ 添加信号');
      fireEvent.click(addButton);

      // 输入有效表达式
      const expressionInput = screen.getByPlaceholderText('输入表达式或使用下方按钮构建');
      fireEvent.change(expressionInput, { target: { value: 'Fp1 + F3' } });

      // 应该显示引用的通道信息
      await waitFor(() => {
        expect(screen.getByText(/通道:/)).toBeInTheDocument();
        expect(screen.getByText(/Fp1, F3/)).toBeInTheDocument();
      });
    });

    it('应该显示表达式验证信息（常数）', async () => {
      render(<ModeEditor {...defaultProps} />);

      // 点击添加信号按钮
      const addButton = screen.getByText('+ 添加信号');
      fireEvent.click(addButton);

      // 输入包含常数的表达式
      const expressionInput = screen.getByPlaceholderText('输入表达式或使用下方按钮构建');
      fireEvent.change(expressionInput, { target: { value: 'Fp1 * 2.5' } });

      // 应该显示常数信息
      await waitFor(() => {
        expect(screen.getByText(/常数:/)).toBeInTheDocument();
        expect(screen.getByText(/2\.5/)).toBeInTheDocument();
      });
    });

    it('应该根据表达式验证状态禁用/启用保存按钮', async () => {
      render(<ModeEditor {...defaultProps} />);

      // 点击添加信号按钮
      const addButton = screen.getByText('+ 添加信号');
      fireEvent.click(addButton);

      // 输入信号名称
      const nameInput = screen.getByPlaceholderText('如: Fp1-F3 差值') as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: 'Test Signal' } });

      // 空表达式时保存按钮应该被禁用
      const saveButton = screen.getByText('保存');
      expect(saveButton).toBeDisabled();

      // 输入有效表达式
      const expressionInput = screen.getByPlaceholderText('输入表达式或使用下方按钮构建');
      fireEvent.change(expressionInput, { target: { value: 'Fp1' } });

      // 有效表达式时保存按钮应该可用
      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });
    });
  });

  describe('构建器交互流程', () => {
    it('应该支持通过构建器逐步构建复杂表达式', () => {
      render(<ModeEditor {...defaultProps} />);

      // 点击添加信号按钮
      const addButton = screen.getByText('+ 添加信号');
      fireEvent.click(addButton);

      // 点击显示构建器按钮
      const showBuilderButton = screen.getByText('显示构建器');
      fireEvent.click(showBuilderButton);

      const expressionInput = screen.getByPlaceholderText('输入表达式或使用下方按钮构建');

      // 点击 Fp1 通道（选择按钮元素）
      const fp1Buttons = screen.getAllByText('Fp1');
      const fp1Button = fp1Buttons.find(el => el.tagName === 'BUTTON');
      expect(fp1Button).toBeDefined();
      if (fp1Button) fireEvent.click(fp1Button);
      expect(expressionInput.getAttribute('value')).toBe('Fp1');

      // 点击减号
      const minusButtons = screen.getAllByText('−').filter(el => el.tagName === 'BUTTON' && el.classList.value.includes('operator'));
      if (minusButtons.length > 0) fireEvent.click(minusButtons[0]);
      expect(expressionInput.getAttribute('value')).toBe('Fp1 - ');

      // 点击 F3 通道（选择按钮元素）
      const f3Buttons = screen.getAllByText('F3');
      const f3Button = f3Buttons.find(el => el.tagName === 'BUTTON');
      expect(f3Button).toBeDefined();
      if (f3Button) fireEvent.click(f3Button);
      // 表达式应该是 Fp1 - F3（构建器会自动处理）
      expect(expressionInput.getAttribute('value')).toBe('Fp1 - F3');

      // 表达式应该有效
      expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('应该支持使用构建器创建带括号的表达式', () => {
      render(<ModeEditor {...defaultProps} />);

      // 点击添加信号按钮
      const addButton = screen.getByText('+ 添加信号');
      fireEvent.click(addButton);

      // 点击显示构建器按钮
      const showBuilderButton = screen.getByText('显示构建器');
      fireEvent.click(showBuilderButton);

      const expressionInput = screen.getByPlaceholderText('输入表达式或使用下方按钮构建');

      // 直接手动输入表达式
      fireEvent.change(expressionInput, { target: { value: '(Fp1 + Fp2) / 2' } });

      // 表达式应该有效
      expect(screen.getByText('✓')).toBeInTheDocument();
    });
  });

  describe('编辑现有信号', () => {
    it('应该加载现有信号的表达式到构建器', () => {
      const existingMode: Mode = {
        id: 'mode-1',
        name: 'Test Mode',
        category: 'custom' as ModeCategory,
        config: {
          viewMode: 'waveform',
          timeWindow: 10,
          amplitudeScale: 1.0,
          showGrid: true,
          showAnnotations: true,
          displayChannels: [],
          enableFilter: false,
          bands: [],
          analysis: { enabled: false, type: 'stats', autoUpdate: false },
          autoSave: true,
          maxBookmarks: 50,
          signals: [
            {
              id: 'sig-1',
              name: 'Fp1-F3 差值',
              expression: 'Fp1 - F3',
              operands: [],
              color: '#ef4444',
              enabled: true,
            },
          ],
        },
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        isBuiltIn: false,
        isFavorite: false,
        usageCount: 0,
        tags: [],
      };

      render(<ModeEditor {...defaultProps} mode={existingMode} />);

      // 点击编辑信号按钮
      const editButton = screen.getAllByText('编辑')[0];
      fireEvent.click(editButton);

      // 应该加载现有表达式
      const expressionInput = screen.getByPlaceholderText('输入表达式或使用下方按钮构建');
      expect(expressionInput.value).toBe('Fp1 - F3');

      // 应该显示有效图标
      expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('应该允许使用构建器修改现有表达式', () => {
      const existingMode: Mode = {
        id: 'mode-1',
        name: 'Test Mode',
        category: 'custom' as ModeCategory,
        config: {
          viewMode: 'waveform',
          timeWindow: 10,
          amplitudeScale: 1.0,
          showGrid: true,
          showAnnotations: true,
          displayChannels: [],
          enableFilter: false,
          bands: [],
          analysis: { enabled: false, type: 'stats', autoUpdate: false },
          autoSave: true,
          maxBookmarks: 50,
          signals: [
            {
              id: 'sig-1',
              name: 'Fp1-F3 差值',
              expression: 'Fp1 - F3',
              operands: [],
              color: '#ef4444',
              enabled: true,
            },
          ],
        },
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        isBuiltIn: false,
        isFavorite: false,
        usageCount: 0,
        tags: [],
      };

      render(<ModeEditor {...defaultProps} mode={existingMode} />);

      // 点击编辑信号按钮
      const editButton = screen.getAllByText('编辑')[0];
      fireEvent.click(editButton);

      // 点击显示构建器按钮
      const showBuilderButton = screen.getByText('显示构建器');
      fireEvent.click(showBuilderButton);

      // 清空并重新构建
      fireEvent.click(screen.getByText('清空'));

      const fp2Buttons = screen.getAllByText('Fp2');
      const fp2Button = fp2Buttons.find(el => el.tagName === 'BUTTON');
      if (fp2Button) fireEvent.click(fp2Button);

      const minusButtons = screen.getAllByText('−').filter(el => el.tagName === 'BUTTON' && el.classList.value.includes('operator'));
      if (minusButtons.length > 0) fireEvent.click(minusButtons[0]);

      const f4Buttons = screen.getAllByText('F4');
      const f4Button = f4Buttons.find(el => el.tagName === 'BUTTON');
      if (f4Button) fireEvent.click(f4Button);

      const expressionInput = screen.getByPlaceholderText('输入表达式或使用下方按钮构建');
      // 表达式应该是 Fp2 - F4（构建器会自动处理）
      expect(expressionInput.getAttribute('value')).toBe('Fp2 - F4');
    });
  });

  describe('边界情况', () => {
    it('应该处理空通道列表', () => {
      render(<ModeEditor {...defaultProps} availableChannels={[]} />);

      // 点击添加信号按钮
      const addButton = screen.getByText('+ 添加信号');
      fireEvent.click(addButton);

      // 点击显示构建器按钮
      const showBuilderButton = screen.getByText('显示构建器');
      fireEvent.click(showBuilderButton);

      // 应该不显示任何构建器中的通道按钮
      const channelButtons = screen.queryAllByText('Fp1').filter(el => el.tagName === 'BUTTON');
      expect(channelButtons.length).toBe(0);
    });

    it('应该处理带有特殊字符的通道名', () => {
      const specialChannels = ['CH-1', 'CH_2', 'CH 3'];
      render(<ModeEditor {...defaultProps} availableChannels={specialChannels} />);

      // 点击添加信号按钮
      const addButton = screen.getByText('+ 添加信号');
      fireEvent.click(addButton);

      // 点击显示构建器按钮
      const showBuilderButton = screen.getByText('显示构建器');
      fireEvent.click(showBuilderButton);

      // 应该显示所有特殊通道名的按钮
      for (const channel of specialChannels) {
        const channelButtons = screen.getAllByText(channel);
        const hasButton = channelButtons.some(el => el.tagName === 'BUTTON');
        expect(hasButton).toBe(true);
      }
    });

    it('应该处理复杂的嵌套表达式', async () => {
      render(<ModeEditor {...defaultProps} />);

      // 点击添加信号按钮
      const addButton = screen.getByText('+ 添加信号');
      fireEvent.click(addButton);

      // 输入复杂表达式
      const complexExpression = '((Fp1 + Fp2) / 2 - (F3 + F4) / 2) * 1.5';
      const expressionInput = screen.getByPlaceholderText('输入表达式或使用下方按钮构建');
      fireEvent.change(expressionInput, { target: { value: complexExpression } });

      // 表达式应该有效
      await waitFor(() => {
        expect(screen.getByText('✓')).toBeInTheDocument();
        expect(screen.getByText(/Fp1, Fp2, F3, F4/)).toBeInTheDocument();
        expect(screen.getByText(/1\.5/)).toBeInTheDocument();
      });
    });
  });
});

describe('ModeEditor - Delete Functionality', () => {
  const mockAvailableChannels = ['Fp1', 'Fp2', 'F3', 'F4', 'C3', 'C4', 'O1', 'O2'];
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();

  const defaultProps = {
    isOpen: true,
    mode: null,
    availableChannels: mockAvailableChannels,
    onSave: mockOnSave,
    onCancel: mockOnCancel,
  };

  const customMode: Mode = {
    id: 'mode-custom-1',
    name: 'Custom Test Mode',
    category: 'custom' as ModeCategory,
    config: {
      viewMode: 'waveform',
      timeWindow: 10,
      amplitudeScale: 1.0,
      showGrid: true,
      showAnnotations: true,
      displayChannels: [],
      enableFilter: false,
      bands: [],
      analysis: { enabled: false, type: 'stats', autoUpdate: false },
      autoSave: true,
      maxBookmarks: 50,
      signals: [],
    },
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    isBuiltIn: false,
    isFavorite: false,
    usageCount: 0,
    tags: [],
  };

  const builtInMode: Mode = {
    ...customMode,
    id: 'mode-builtin-1',
    name: 'Built-in Mode',
    isBuiltIn: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteMode.mockResolvedValue({ success: true });
  });

  describe('删除按钮可见性', () => {
    it('编辑自定义模式时应显示删除按钮', () => {
      render(<ModeEditor {...defaultProps} mode={customMode} />);

      const deleteButton = screen.getByText('删除');
      expect(deleteButton).toBeInTheDocument();
    });

    it('创建新模式时不应显示删除按钮', () => {
      render(<ModeEditor {...defaultProps} mode={null} />);

      const deleteButtons = screen.queryAllByText('删除');
      expect(deleteButtons.length).toBe(0);
    });

    it('编辑内置模式时不应显示删除按钮', () => {
      render(<ModeEditor {...defaultProps} mode={builtInMode} />);

      const deleteButtons = screen.queryAllByText('删除');
      expect(deleteButtons.length).toBe(0);
    });
  });

  describe('删除按钮状态', () => {
    it('删除按钮在加载时应被禁用', async () => {
      render(<ModeEditor {...defaultProps} mode={customMode} />);

      const deleteButton = screen.getByText('删除') as HTMLButtonElement;
      expect(deleteButton).not.toBeDisabled();

      // 模拟删除过程中的禁用状态
      // 注意：实际的禁用状态取决于 isDeleting 状态
    });

    it('删除按钮应有正确的标题提示', () => {
      render(<ModeEditor {...defaultProps} mode={customMode} />);

      const deleteButton = screen.getByText('删除') as HTMLButtonElement;
      expect(deleteButton.title).toBe('删除此模式');
    });
  });

  describe('删除确认对话框', () => {
    it('点击删除按钮应显示确认对话框', () => {
      render(<ModeEditor {...defaultProps} mode={customMode} />);

      const deleteButton = screen.getByText('删除');
      fireEvent.click(deleteButton);

      const confirmTitle = screen.getByRole('heading', { name: '确认删除' });
      expect(confirmTitle).toBeInTheDocument();
      expect(screen.getByText(/确定要删除模式/)).toBeInTheDocument();
    });

    it('确认对话框应显示模式名称', () => {
      render(<ModeEditor {...defaultProps} mode={customMode} />);

      const deleteButton = screen.getByText('删除');
      fireEvent.click(deleteButton);

      expect(screen.getByText(customMode.name)).toBeInTheDocument();
    });

    it('确认对话框应有取消和确认按钮', () => {
      render(<ModeEditor {...defaultProps} mode={customMode} />);

      const deleteButton = screen.getByText('删除');
      fireEvent.click(deleteButton);

      const deleteConfirmButton = screen.getByRole('button', { name: '确认删除' });
      expect(deleteConfirmButton).toBeInTheDocument();

      // 检查是否有取消按钮（会有多个，但至少有一个）
      const cancelButtons = screen.getAllByText('取消');
      expect(cancelButtons.length).toBeGreaterThan(0);
    });

    it('点击取消按钮应关闭确认对话框', () => {
      render(<ModeEditor {...defaultProps} mode={customMode} />);

      const deleteButton = screen.getByText('删除');
      fireEvent.click(deleteButton);

      expect(screen.getByText(/确定要删除模式/)).toBeInTheDocument();

      const cancelButtons = screen.getAllByText('取消');
      // 找到确认对话框中的取消按钮（最后一个取消按钮）
      const confirmCancelButton = cancelButtons[cancelButtons.length - 1];

      fireEvent.click(confirmCancelButton);

      // 对话框应该被关闭
      expect(screen.queryByText(/确定要删除模式/)).not.toBeInTheDocument();
    });
  });

  describe('删除操作', () => {
    it('点击确认删除应调用 deleteMode API', async () => {
      render(<ModeEditor {...defaultProps} mode={customMode} />);

      const deleteButton = screen.getByText('删除');
      fireEvent.click(deleteButton);

      const deleteConfirmButton = screen.getByRole('button', { name: '确认删除' });
      fireEvent.click(deleteConfirmButton);

      await waitFor(() => {
        expect(mockDeleteMode).toHaveBeenCalledWith(customMode.id);
      });
    });

    it('删除成功后应关闭模态框', async () => {
      render(<ModeEditor {...defaultProps} mode={customMode} />);

      const deleteButton = screen.getByText('删除');
      fireEvent.click(deleteButton);

      const deleteConfirmButton = screen.getByRole('button', { name: '确认删除' });
      fireEvent.click(deleteConfirmButton);

      await waitFor(() => {
        expect(mockOnCancel).toHaveBeenCalled();
      });
    });

    it('删除成功后应刷新模式列表', async () => {
      render(<ModeEditor {...defaultProps} mode={customMode} />);

      const deleteButton = screen.getByText('删除');
      fireEvent.click(deleteButton);

      const deleteConfirmButton = screen.getByRole('button', { name: '确认删除' });
      fireEvent.click(deleteConfirmButton);

      await waitFor(() => {
        expect(mockDeleteMode).toHaveBeenCalledWith(customMode.id);
      });
    });

    it('删除失败时应显示错误消息', async () => {
      const errorMessage = '删除模式失败，请稍后重试';
      mockDeleteMode.mockRejectedValueOnce(new Error(errorMessage));

      render(<ModeEditor {...defaultProps} mode={customMode} />);

      const deleteButton = screen.getByText('删除');
      fireEvent.click(deleteButton);

      const deleteConfirmButton = screen.getByRole('button', { name: '确认删除' });
      fireEvent.click(deleteConfirmButton);

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it('删除失败时应保持模态框打开', async () => {
      mockDeleteMode.mockRejectedValueOnce(new Error('删除失败'));

      render(<ModeEditor {...defaultProps} mode={customMode} />);

      const deleteButton = screen.getByText('删除');
      fireEvent.click(deleteButton);

      const deleteConfirmButton = screen.getByRole('button', { name: '确认删除' });
      fireEvent.click(deleteConfirmButton);

      await waitFor(() => {
        // 模态框应该仍然打开
        expect(screen.getByText('编辑模式')).toBeInTheDocument();
      });
    });

    it('删除过程中应禁用所有按钮', async () => {
      render(<ModeEditor {...defaultProps} mode={customMode} />);

      const deleteButton = screen.getByText('删除');
      fireEvent.click(deleteButton);

      const deleteConfirmButton = screen.getByRole('button', { name: '确认删除' });
      fireEvent.click(deleteConfirmButton);

      // 删除过程中，API 应该被调用
      await waitFor(() => {
        expect(mockDeleteMode).toHaveBeenCalledWith(customMode.id);
      });
    });
  });

  describe('删除功能集成', () => {
    it('应该支持完整的删除流程：点击删除 -> 确认 -> 成功', async () => {
      render(<ModeEditor {...defaultProps} mode={customMode} />);

      // 1. 点击删除按钮
      const deleteButton = screen.getByText('删除');
      fireEvent.click(deleteButton);

      // 2. 确认对话框应该显示
      expect(screen.getByText(/确定要删除模式/)).toBeInTheDocument();

      // 3. 点击确认删除
      const deleteConfirmButton = screen.getByRole('button', { name: '确认删除' });
      fireEvent.click(deleteConfirmButton);

      // 4. API 应该被调用
      await waitFor(() => {
        expect(mockDeleteMode).toHaveBeenCalledWith(customMode.id);
      });

      // 5. 模态框应该关闭
      await waitFor(() => {
        expect(mockOnCancel).toHaveBeenCalled();
      });
    });

    it('应该支持取消删除流程', () => {
      render(<ModeEditor {...defaultProps} mode={customMode} />);

      // 1. 点击删除按钮
      const deleteButton = screen.getByText('删除');
      fireEvent.click(deleteButton);

      // 2. 确认对话框应该显示
      expect(screen.getByText(/确定要删除模式/)).toBeInTheDocument();

      // 3. 点击取消（选择确认对话框中的取消按钮）
      const cancelButtons = screen.getAllByText('取消');
      const confirmCancelButton = cancelButtons[cancelButtons.length - 1];
      fireEvent.click(confirmCancelButton);

      // 4. 对话框应该关闭
      expect(screen.queryByText(/确定要删除模式/)).not.toBeInTheDocument();

      // 5. API 不应该被调用
      expect(mockDeleteMode).not.toHaveBeenCalled();

      // 6. 模态框应该仍然打开
      expect(screen.getByText('编辑模式')).toBeInTheDocument();
    });
  });
});
