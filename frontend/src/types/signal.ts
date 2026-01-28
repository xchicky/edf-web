/**
 * Signal 类型定义
 * 用于派生信号（通过四则运算组合通道）的数据模型
 */

/**
 * 操作数定义 - 表示表达式中的一个通道引用
 */
export interface OperandDefinition {
  id: string;                    // 唯一 ID
  channelName: string;           // 通道名称（如 "Fp1"）
  channelIndex: number;          // 通道索引（0-based）
  coefficient?: number;          // 可选系数（默认 1.0）
}

/**
 * Signal 模型 - 派生信号定义
 */
export interface Signal {
  id: string;                    // 唯一标识符（如 "sig-1234567890"）
  name: string;                  // 显示名称（如"Fp1-F7"）
  expression: string;            // 数学表达式（如"Fp1 - F7"）
  operands: OperandDefinition[]; // 操作数定义（通道引用）
  description?: string;          // 可选描述
  color?: string;                // 可选自定义颜色
  enabled: boolean;              // 是否显示
  createdAt: number;             // 创建时间戳
  modifiedAt: number;            // 修改时间戳
}

/**
 * 表达式验证结果
 */
export interface SignalValidation {
  isValid: boolean;
  error?: string;
  referencedChannels?: string[]; // 使用的通道名称
  constants?: number[];          // 使用的常数
}

/**
 * 信号计算结果
 */
export interface SignalComputationResult {
  id: string;
  name: string;
  data: number[];                // 计算后的信号数据
  times: number[];               // 时间数组
  sfreq: number;                 // 采样频率
  n_samples: number;
  isVirtual: true;
}

/**
 * 信号计算请求
 */
export interface SignalCalculationRequest {
  file_id: string;
  signals: Array<{
    id: string;
    expression: string;
    operands: OperandDefinition[];
  }>;
  start: number;
  duration: number;
}

/**
 * 信号计算响应
 */
export interface SignalCalculationResponse {
  results: SignalComputationResult[];
}
