/**
 * 信号存储工具
 * 用于 localStorage 的持久化操作
 */

import type { Signal } from '../types/signal';

const STORAGE_KEY_PREFIX = 'edf-signals';

/**
 * 生成存储 key
 */
function getStorageKey(fileId: string): string {
  return `${STORAGE_KEY_PREFIX}-${fileId}`;
}

/**
 * 保存信号到 localStorage
 */
export function saveSignals(fileId: string, signals: Signal[]): void {
  try {
    const key = getStorageKey(fileId);
    const data = JSON.stringify(signals);
    localStorage.setItem(key, data);
  } catch (error) {
    console.error('保存信号失败:', error);
    throw new Error('无法保存信号到本地存储');
  }
}

/**
 * 从 localStorage 加载信号
 */
export function loadSignals(fileId: string): Signal[] {
  try {
    const key = getStorageKey(fileId);
    const data = localStorage.getItem(key);
    if (!data) {
      return [];
    }
    return JSON.parse(data) as Signal[];
  } catch (error) {
    console.error('加载信号失败:', error);
    return [];
  }
}

/**
 * 删除 localStorage 中的信号
 */
export function deleteSignals(fileId: string): void {
  try {
    const key = getStorageKey(fileId);
    localStorage.removeItem(key);
  } catch (error) {
    console.error('删除信号失败:', error);
  }
}

/**
 * 检查是否存在已保存的信号
 */
export function hasSignals(fileId: string): boolean {
  try {
    const key = getStorageKey(fileId);
    return localStorage.getItem(key) !== null;
  } catch (error) {
    console.error('检查信号失败:', error);
    return false;
  }
}

/**
 * 获取所有已保存的信号文件 ID
 */
export function getAllSignalFileIds(): string[] {
  try {
    const fileIds: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        const fileId = key.substring(STORAGE_KEY_PREFIX.length + 1);
        fileIds.push(fileId);
      }
    }
    return fileIds;
  } catch (error) {
    console.error('获取信号文件 ID 失败:', error);
    return [];
  }
}

/**
 * 清空所有已保存的信号
 */
export function clearAllSignals(): void {
  try {
    const fileIds = getAllSignalFileIds();
    for (const fileId of fileIds) {
      deleteSignals(fileId);
    }
  } catch (error) {
    console.error('清空所有信号失败:', error);
  }
}

/**
 * 获取 localStorage 中信号数据的大小（字节）
 */
export function getSignalsStorageSize(fileId: string): number {
  try {
    const key = getStorageKey(fileId);
    const data = localStorage.getItem(key);
    if (!data) {
      return 0;
    }
    return new Blob([data]).size;
  } catch (error) {
    console.error('获取存储大小失败:', error);
    return 0;
  }
}
