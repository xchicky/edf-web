/**
 * Mode 类型定义
 * 用于 EEG 数据分析模式管理的完整数据模型
 */

/**
 * 模式分类
 */
export type ModeCategory =
  | 'clinical'       // 临床诊断模式
  | 'research'       // 研究分析模式
  | 'education'      // 教学演示模式
  | 'custom';        // 自定义模式

/**
 * 数据源类型
 */
export type DataSourceType =
  | 'raw'           // 原始 EEG 数据
  | 'filtered'      // 滤波后数据
  | 'derived';      // 派生信号

/**
 * 视图模式
 */
export type ViewMode =
  | 'waveform'      // 波形视图
  | 'frequency'     // 频谱视图
  | 'topography'    // 地形图
  | '3d';           // 3D 视图

/**
 * 显示通道配置
 */
export interface DisplayChannel {
  channelName: string;         // 通道名称
  channelIndex: number;        // 通道索引
  color?: string;              // 可选颜色
  scale?: number;              // 可选缩放因子
  visible: boolean;            // 是否可见
}

/**
 * 频带配置
 */
export interface BandConfig {
  name: string;                // 频带名称 (如 'alpha')
  range: [number, number];     // 频率范围 [Hz]
  enabled: boolean;            // 是否启用
  color?: string;              // 显示颜色
}

/**
 * 分析参数
 */
export interface AnalysisParams {
  enabled: boolean;            // 是否启用分析
  type: 'stats' | 'frequency' | 'comprehensive';  // 分析类型
  autoUpdate: boolean;         // 是否自动更新
  updateInterval?: number;     // 更新间隔 (ms)
}

/**
 * 模式中的派生信号配置
 * 用于在模式中预定义派生信号
 */
export interface ModeSignalConfig {
  id: string;                  // 信号唯一标识符
  name: string;                // 信号显示名称
  expression: string;          // 数学表达式 (如 "Fp1 - F3")
  operands: Operand[];         // 操作数定义 (通道引用)
  color?: string;              // 可选颜色
  enabled: boolean;            // 是否启用
}

/**
 * 操作数定义 - 派生信号表达式中引用的通道
 */
export interface Operand {
  id: string;                  // 操作数唯一标识符
  channelName: string;         // 通道名称 (如 "Fp1")
  channelIndex: number;        // 通道索引 (0-based)
  coefficient?: number;        // 可选系数 (默认 1.0)
}

/**
 * 模式配置
 */
export interface ModeConfig {
  // 显示设置
  viewMode: ViewMode;
  timeWindow: number;          // 时间窗口 (秒)
  amplitudeScale: number;      // 振幅缩放
  showGrid: boolean;           // 显示网格
  showAnnotations: boolean;    // 显示标注

  // 通道配置
  displayChannels: DisplayChannel[];

  // 滤波设置
  enableFilter: boolean;       // 启用滤波
  filterHighPass?: number;     // 高通滤波频率 (Hz)
  filterLowPass?: number;      // 低通滤波频率 (Hz)

  // 频带设置
  bands: BandConfig[];

  // 分析设置
  analysis: AnalysisParams;

  // 派生信号配置
  signals?: ModeSignalConfig[];  // 模式中包含的派生信号列表

  // 其他设置
  autoSave: boolean;           // 自动保存
  maxBookmarks: number;        // 最大书签数
}

/**
 * 模式定义 - 主模型
 */
export interface Mode {
  id: string;                  // 唯一标识符
  name: string;                // 模式名称
  category: ModeCategory;      // 分类
  description?: string;        // 描述
  config: ModeConfig;          // 配置

  // 元数据
  createdAt: number;           // 创建时间戳
  modifiedAt: number;          // 修改时间戳
  createdBy?: string;          // 创建者
  isBuiltIn: boolean;          // 是否内置模式
  isFavorite: boolean;         // 是否收藏

  // 使用统计
  usageCount: number;          // 使用次数
  lastUsedAt?: number;         // 最后使用时间

  // 兼容性
  requiredChannels?: string[]; // 必需通道
  minSamplingRate?: number;    // 最小采样率
  tags: string[];              // 标签
}

/**
 * 兼容性检查结果
 */
export interface CompatibilityCheckResult {
  isCompatible: boolean;       // 是否兼容
  issues: CompatibilityIssue[];  // 问题列表
  warnings: string[];          // 警告列表
  canApplyWithFixes: boolean;  // 是否可以应用并修复
}

/**
 * 兼容性问题
 */
export interface CompatibilityIssue {
  type: 'missing_channel' | 'low_sampling_rate' | 'config_conflict' | 'other';
  severity: 'error' | 'warning';
  message: string;             // 问题描述
  suggestion?: string;         // 修复建议
}

/**
 * 模式推荐结果
 */
export interface ModeRecommendation {
  mode: Mode;                  // 推荐的模式
  score: number;               // 推荐分数 (0-1)
  reason: string[];            // 推荐理由
  compatibility: CompatibilityCheckResult;  // 兼容性检查结果
}

/**
 * 模式使用统计
 */
export interface ModeUsageStats {
  modeId: string;
  modeName: string;
  totalUses: number;           // 总使用次数
  lastUsedAt: number;          // 最后使用时间
  firstUsedAt: number;         // 首次使用时间
  avgSessionDuration?: number; // 平均会话时长
}

/**
 * 模式创建/更新请求
 */
export interface ModeCreateRequest {
  name: string;
  category: ModeCategory;
  description?: string;
  config: ModeConfig;
  tags?: string[];
}

/**
 * 模式列表响应
 */
export interface ModeListResponse {
  modes: Mode[];
  total: number;
  categories: ModeCategory[];
}

/**
 * 兼容性检查请求
 */
export interface CompatibilityCheckRequest {
  modeId: string;
  channelNames: string[];
  samplingRate: number;
  duration?: number;
}

/**
 * 批量应用模式请求
 */
export interface BatchApplyModeRequest {
  modeIds: string[];
  channelNames: string[];
  samplingRate: number;
}

/**
 * 模式应用结果
 */
export interface ModeApplyResult {
  success: boolean;
  mode: Mode;
  appliedConfig: Partial<ModeConfig>;
  issues: CompatibilityIssue[];
}

/**
 * 内置模式预设
 */
export const BUILT_IN_MODES: Mode[] = [
  {
    id: 'mode-clinical-standard',
    name: '临床标准模式',
    category: 'clinical',
    description: '标准临床 EEG 分析视图，包含常用通道和基本分析',
    config: {
      viewMode: 'waveform',
      timeWindow: 10,
      amplitudeScale: 1.0,
      showGrid: true,
      showAnnotations: true,
      displayChannels: [
        { channelName: 'Fp1', channelIndex: 0, visible: true },
        { channelName: 'Fp2', channelIndex: 1, visible: true },
        { channelName: 'F3', channelIndex: 2, visible: true },
        { channelName: 'F4', channelIndex: 3, visible: true },
        { channelName: 'C3', channelIndex: 4, visible: true },
        { channelName: 'C4', channelIndex: 5, visible: true },
        { channelName: 'O1', channelIndex: 6, visible: true },
        { channelName: 'O2', channelIndex: 7, visible: true },
      ],
      enableFilter: true,
      filterHighPass: 0.5,
      filterLowPass: 70,
      bands: [
        { name: 'delta', range: [0.5, 4], enabled: true, color: '#6366f1' },
        { name: 'theta', range: [4, 8], enabled: true, color: '#8b5cf6' },
        { name: 'alpha', range: [8, 13], enabled: true, color: '#ec4899' },
        { name: 'beta', range: [13, 30], enabled: true, color: '#f59e0b' },
      ],
      // 派生信号示例
      signals: [
        {
          id: 'sig-fp1-f3-diff',
          name: 'Fp1-F3 差值',
          expression: 'Fp1 - F3',
          operands: [
            { id: 'op-fp1', channelName: 'Fp1', channelIndex: 0 },
            { id: 'op-f3', channelName: 'F3', channelIndex: 2 },
          ],
          color: '#ef4444',
          enabled: true,
        },
        {
          id: 'sig-fp2-f4-diff',
          name: 'Fp2-F4 差值',
          expression: 'Fp2 - F4',
          operands: [
            { id: 'op-fp2', channelName: 'Fp2', channelIndex: 1 },
            { id: 'op-f4', channelName: 'F4', channelIndex: 3 },
          ],
          color: '#f59e0b',
          enabled: true,
        },
      ],
      analysis: {
        enabled: true,
        type: 'comprehensive',
        autoUpdate: false,
      },
      autoSave: true,
      maxBookmarks: 50,
    },
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    isBuiltIn: true,
    isFavorite: false,
    usageCount: 0,
    tags: ['临床', '标准', '诊断'],
  },
  {
    id: 'mode-research-spectral',
    name: '频谱研究模式',
    category: 'research',
    description: '专注于频域分析的科研模式，包含完整频带和高级分析',
    config: {
      viewMode: 'frequency',
      timeWindow: 5,
      amplitudeScale: 1.0,
      showGrid: true,
      showAnnotations: false,
      displayChannels: [
        { channelName: 'Fz', channelIndex: 0, visible: true },
        { channelName: 'Cz', channelIndex: 1, visible: true },
        { channelName: 'Pz', channelIndex: 2, visible: true },
      ],
      enableFilter: true,
      filterHighPass: 0.5,
      filterLowPass: 100,
      bands: [
        { name: 'delta', range: [0.5, 4], enabled: true, color: '#6366f1' },
        { name: 'theta', range: [4, 8], enabled: true, color: '#8b5cf6' },
        { name: 'alpha', range: [8, 13], enabled: true, color: '#ec4899' },
        { name: 'beta', range: [13, 30], enabled: true, color: '#f59e0b' },
        { name: 'gamma', range: [30, 50], enabled: true, color: '#10b981' },
      ],
      // 派生信号示例 - 频域分析差值信号
      signals: [
        {
          id: 'sig-fz-cz-diff',
          name: 'Fz-Cz 差值',
          expression: 'Fz - Cz',
          operands: [
            { id: 'op-fz', channelName: 'Fz', channelIndex: 0 },
            { id: 'op-cz', channelName: 'Cz', channelIndex: 1 },
          ],
          color: '#8b5cf6',
          enabled: true,
        },
        {
          id: 'sig-cz-pz-diff',
          name: 'Cz-Pz 差值',
          expression: 'Cz - Pz',
          operands: [
            { id: 'op-cz2', channelName: 'Cz', channelIndex: 1 },
            { id: 'op-pz', channelName: 'Pz', channelIndex: 2 },
          ],
          color: '#ec4899',
          enabled: true,
        },
      ],
      analysis: {
        enabled: true,
        type: 'frequency',
        autoUpdate: true,
        updateInterval: 1000,
      },
      autoSave: true,
      maxBookmarks: 100,
    },
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    isBuiltIn: true,
    isFavorite: false,
    usageCount: 0,
    requiredChannels: ['Fz', 'Cz', 'Pz'],
    minSamplingRate: 100,
    tags: ['科研', '频谱', '高级'],
  },
  {
    id: 'mode-education-basic',
    name: '基础教学模式',
    category: 'education',
    description: '简化视图，适合教学演示和学生练习',
    config: {
      viewMode: 'waveform',
      timeWindow: 15,
      amplitudeScale: 1.5,
      showGrid: true,
      showAnnotations: true,
      displayChannels: [
        { channelName: 'Fp1', channelIndex: 0, visible: true },
        { channelName: 'Fp2', channelIndex: 1, visible: true },
      ],
      enableFilter: false,
      bands: [
        { name: 'alpha', range: [8, 13], enabled: true, color: '#ec4899' },
        { name: 'beta', range: [13, 30], enabled: true, color: '#f59e0b' },
      ],
      analysis: {
        enabled: false,
        type: 'stats',
        autoUpdate: false,
      },
      autoSave: false,
      maxBookmarks: 20,
    },
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    isBuiltIn: true,
    isFavorite: false,
    usageCount: 0,
    tags: ['教学', '基础', '演示'],
  },
];

/**
 * 模式分类配置
 */
export const MODE_CATEGORIES: Record<ModeCategory, { label: string; description: string; icon: string }> = {
  clinical: {
    label: '临床诊断',
    description: '用于临床 EEG 分析和诊断的模式',
    icon: '🏥',
  },
  research: {
    label: '科学研究',
    description: '用于科研和数据分析的高级模式',
    icon: '🔬',
  },
  education: {
    label: '教学演示',
    description: '简化的教学和演示模式',
    icon: '📚',
  },
  custom: {
    label: '自定义',
    description: '用户自定义的个性化模式',
    icon: '⚙️',
  },
};

/**
 * 视图模式配置
 */
export const VIEW_MODES: Record<ViewMode, { label: string; description: string }> = {
  waveform: {
    label: '波形视图',
    description: '显示 EEG 信号的时域波形',
  },
  frequency: {
    label: '频谱视图',
    description: '显示信号的频域特征',
  },
  topography: {
    label: '地形图',
    description: '显示头皮电位分布',
  },
  '3d': {
    label: '3D 视图',
    description: '三维空间展示',
  },
};

/**
 * 默认频带配置
 */
export const DEFAULT_BANDS: BandConfig[] = [
  { name: 'delta', range: [0.5, 4], enabled: true, color: '#6366f1' },
  { name: 'theta', range: [4, 8], enabled: true, color: '#8b5cf6' },
  { name: 'alpha', range: [8, 13], enabled: true, color: '#ec4899' },
  { name: 'beta', range: [13, 30], enabled: true, color: '#f59e0b' },
  { name: 'gamma', range: [30, 50], enabled: false, color: '#10b981' },
];

/**
 * 默认模式配置
 */
export const DEFAULT_MODE_CONFIG: ModeConfig = {
  viewMode: 'waveform',
  timeWindow: 10,
  amplitudeScale: 1.0,
  showGrid: true,
  showAnnotations: true,
  displayChannels: [],
  enableFilter: false,
  bands: DEFAULT_BANDS,
  analysis: {
    enabled: false,
    type: 'stats',
    autoUpdate: false,
  },
  signals: [],  // 空的派生信号列表
  autoSave: true,
  maxBookmarks: 50,
};
