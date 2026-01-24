/**
 * Environment configuration with type-safe access
 */

interface EnvConfig {
  apiUrl: string
  apiPath: string
  appTitle: string
  appVersion: string
  enableOverviewStrip: boolean
  enableBookmarks: boolean
  enableKeyboardShortcuts: boolean
}

/**
 * Get environment variable with default value
 */
function getEnvVar(key: string, defaultValue: string): string {
  const value = import.meta.env[key]
  return value || defaultValue
}

/**
 * Parse boolean environment variable
 */
function parseBoolean(value: string): boolean {
  return value.toLowerCase() === 'true'
}

/**
 * Validated environment configuration
 */
export const env: EnvConfig = {
  apiUrl: getEnvVar('VITE_API_BASE_URL', 'http://localhost:8000'),
  apiPath: getEnvVar('VITE_API_BASE_PATH', '/api'),
  appTitle: getEnvVar('VITE_APP_TITLE', 'EDF Viewer'),
  appVersion: getEnvVar('VITE_APP_VERSION', '2.0.0'),
  enableOverviewStrip: parseBoolean(getEnvVar('VITE_ENABLE_OVERVIEW_STRIP', 'true')),
  enableBookmarks: parseBoolean(getEnvVar('VITE_ENABLE_BOOKMARKS', 'true')),
  enableKeyboardShortcuts: parseBoolean(getEnvVar('VITE_ENABLE_KEYBOARD_SHORTCUTS', 'true')),
}

/**
 * Get full API URL for a specific endpoint
 */
export function getApiUrl(endpoint: string): string {
  return `${env.apiUrl}${env.apiPath}${endpoint}`
}
