/**
 * E2E Test Fixtures and Helpers
 */

import { test as base, Page } from '@playwright/test';
import { EDFAppPage } from './EDFAppPage';

/**
 * Extended test fixture with EDFAppPage
 */
export const test = base.extend<{
  edfApp: EDFAppPage;
}>({
  edfApp: async ({ page }, use) => {
    const edfApp = new EDFAppPage(page);
    await use(edfApp);
  },
});

export { expect } from '@playwright/test';

/**
 * Create a minimal EDF file for testing
 * This generates a valid EDF header and minimal data
 */
export function createTestEDFFile(content: string = 'test'): Buffer {
  // EDF header is 256 bytes
  const header = Buffer.alloc(256);

  // Version (8 bytes)
  header.write('0       ', 0);

  // Patient ID (80 bytes)
  header.write('Test Patient                                                  ', 8);

  // Recording ID (80 bytes)
  header.write('Test Recording                                                ', 88);

  // Start date (8 bytes)
  header.write('01.02.26', 168);

  // Start time (8 bytes)
  header.write('00.00.00', 176);

  // Header bytes (8 bytes)
  header.write('256     ', 184);

  // Reserved (44 bytes)
  header.write(' '.repeat(44), 192);

  // Number of signals (8 bytes)
  const numSignals = 1;
  header.write(`${numSignals}       `.slice(0, 8), 236);

  // Label for each signal (16 * numSignals bytes)
  header.write('Fp1             ', 256);

  // Transducer type (80 * numSignals bytes)
  header.write('                                        ', 272);

  // Physical dimension (8 * numSignals bytes)
  header.write('uV      ', 352);

  // Physical minimum (8 * numSignals bytes)
  header.write('-500    ', 360);

  // Physical maximum (8 * numSignals bytes)
  header.write('500     ', 368);

  // Digital minimum (8 * numSignals bytes)
  header.write('-32768  ', 376);

  // Digital maximum (8 * numSignals bytes)
  header.write('32767   ', 384);

  // Prefiltering (80 * numSignals bytes)
  header.write('                                        ', 392);

  // Number of samples (8 * numSignals bytes)
  header.write('256     ', 472);

  // Reserved (32 * numSignals bytes)
  header.write('                                ', 480);

  // Combine header with data records
  const dataRecords = 10; // 10 data records
  const samplesPerRecord = 256;

  // Create minimal data (int16 values)
  const dataBuffer = Buffer.alloc(dataRecords * samplesPerRecord * 2);
  for (let i = 0; i < dataBuffer.length; i += 2) {
    // Write small signal values
    dataBuffer.writeInt16LE(Math.floor(Math.sin(i / 10) * 100), i);
  }

  return Buffer.concat([header, dataBuffer]);
}

/**
 * Path to test EDF file (if exists in project)
 */
export const TEST_EDF_PATH = './tests/fixtures/sample.edf';

/**
 * Common test expressions for derived signals
 */
export const TEST_EXPRESSIONS = {
  simpleDifference: 'Fp1 - F3',
  average: '(Fp1 + F3) / 2',
  absoluteValue: 'np.abs(Fp1 - F3)',
  mean: 'np.mean([Fp1, F3, Fz])',
  invalid: 'Fp1 + * F3', // Invalid syntax
  undefinedChannel: 'Fp1 - UNKNOWN', // Undefined channel
} as const;

/**
 * Default test timeouts
 */
export const TIMEOUTS = {
  short: 5000,
  medium: 10000,
  long: 30000,
  analysis: 60000, // Analysis can take longer
} as const;

/**
 * Wait for app to be ready
 */
export async function waitForAppReady(page: Page): Promise<void> {
  // Wait for React app to mount
  await page.waitForSelector('body', { timeout: TIMEOUTS.medium });
  // Wait for any initial loading to complete
  await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.long });
}

/**
 * Clear localStorage before test
 * Must be called after page navigation or use context.addInitScript instead
 */
export async function clearStorage(page: Page): Promise<void> {
  // Use addInitScript to clear storage before page loads
  await page.context().addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Setup API route mocking for EDF endpoints
 * This allows tests to run without a real backend
 *
 * @param options - Mock configuration options
 * @param options.rejectInvalidFiles - If true, return 422 for non-.edf files (default: false for simplicity)
 */
export async function setupMockAPI(page: Page, options: { rejectInvalidFiles?: boolean } = {}) {
  const { rejectInvalidFiles = false } = options;
  // Mock health check
  await page.route('**/api/health', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'healthy', version: '1.0.0' })
    });
  });

  // Mock metadata endpoint - match any URL with api/metadata
  await page.route(/\/api\/metadata/, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_METADATA)
    });
  });

  // Mock waveform endpoint - match any URL with api/waveform
  await page.route(/\/api\/waveform/, async route => {
    const url = new URL(route.request().url());
    const start = parseFloat(url.searchParams.get('start') || '0');
    const duration = parseFloat(url.searchParams.get('duration') || '10');
    const channelsParam = url.searchParams.get('channels');
    const channelIndices = channelsParam ? channelsParam.split(',').map(Number) : Array.from({ length: 19 }, (_, i) => i);

    const sfreq = MOCK_METADATA.sfreq || 256;

    // Generate synthetic waveform data for selected channels
    const data: number[][] = channelIndices.map(() => {
      const samples: number[] = [];
      for (let i = 0; i < duration * sfreq; i++) {
        samples.push(Math.sin((start + i / sfreq) * 2 * Math.PI) * 100 + Math.random() * 10);
      }
      return samples;
    });

    // Get channel names for selected channels
    const selectedChannels = channelIndices.map(i => MOCK_METADATA.channel_names[i] || `Channel${i}`);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        file_id: MOCK_METADATA.file_id,
        data,
        channels: selectedChannels,
        times: Array.from({ length: duration * sfreq }, (_, i) => start + i / sfreq),
        sfreq,
        n_samples: duration * sfreq,
        start_time: start,
        duration
      })
    });
  });

  // Mock upload endpoint - match POST to /api/upload/
  await page.route(/\/api\/upload\//, async route => {
    const request = route.request();
    const postData = request.postData();

    // Check if invalid file rejection is enabled and this might be an invalid file
    if (rejectInvalidFiles && postData) {
      // Try to detect .txt files in the multipart data
      const dataStr = postData.toString();
      if (dataStr.toLowerCase().includes('.txt') || dataStr.toLowerCase().includes('name="file"')) {
        // Check the Content-Disposition for filename
        if (dataStr.includes('filename=') && dataStr.includes('.txt')) {
          await route.fulfill({
            status: 422,
            contentType: 'application/json',
            body: JSON.stringify({
              detail: 'Invalid file format. Only .edf files are supported.'
            })
          });
          return;
        }
      }
    }

    // Return mock metadata response directly (same as backend)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_METADATA)
    });
  });

  // Mock signals validate endpoint
  await page.route(/\/api\/signals\/validate/, async route => {
    try {
      const requestBody = await route.request().postDataJSON();
      const expression = requestBody.expression;

      // Simple validation - check if expression is not empty
      const isValid = expression && expression.length > 0 && !expression.includes('**');

      // Extract channel names from expression
      const channelMatches = expression.match(/[A-Z][a-z0-9]*/g) || [];
      const referencedChannels = [...new Set(channelMatches)];

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          isValid,
          referencedChannels,
          error: isValid ? undefined : 'Invalid expression'
        })
      });
    } catch (e) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          isValid: true,
          referencedChannels: [],
          error: undefined
        })
      });
    }
  });

  // Mock signals calculate endpoint
  await page.route(/\/api\/signals\/calculate/, async route => {
    const requestBody = await route.request().postDataJSON();
    const { signals, start, duration } = requestBody;

    const results = signals.map((signal: any) => {
      const startTime = parseFloat(start);
      const dur = parseFloat(duration);
      const samples = dur * 256; // 256 Hz

      return {
        id: signal.id,
        data: Array.from({ length: samples }, () => Math.random() * 100),
        times: Array.from({ length: samples }, (_, i) => startTime + i / 256),
        sfreq: 256,
        n_samples: samples
      };
    });

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(results)
    });
  });

  // Mock overview endpoint
  await page.route(/\/api\/waveform_overview/, async route => {
    const url = new URL(route.request().url());
    const channelsParam = url.searchParams.get('channels');
    const channelIndices = channelsParam ? channelsParam.split(',').map(Number) : Array.from({ length: 19 }, (_, i) => i);

    // Generate synthetic overview data
    const samplesPerSecond = 1;
    const totalDuration = 600; // 10 minutes
    const totalSamples = totalDuration * samplesPerSecond;

    const data: number[][] = channelIndices.map(() =>
      Array.from({ length: totalSamples }, () => Math.random() * 100)
    );

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        file_id: MOCK_METADATA.file_id,
        data,
        times: Array.from({ length: totalSamples }, (_, i) => i),
        channels: channelIndices.map(i => MOCK_METADATA.channel_names[i] || `Channel${i}`),
        sfreq: samplesPerSecond,
        n_samples: totalSamples,
        start_time: 0,
        duration: totalDuration
      })
    });
  });
}

/**
 * Mock EDF metadata for API mocking
 */
export const MOCK_METADATA = {
  file_id: 'test-file-id',
  filename: 'test.edf',
  file_size_mb: 1.5,
  patient_id: 'Test Patient',
  recording_id: 'Test Recording',
  start_date: '2026-02-01',
  start_time: '00:00:00',
  num_records: 1000,
  duration: 600, // 10 minutes
  duration_seconds: 600,
  duration_minutes: 10.0,
  num_signals: 19,
  n_channels: 19,
  channel_names: [
    'Fp1', 'Fp2', 'F3', 'F4', 'C3', 'C4', 'P3', 'P4', 'O1', 'O2',
    'F7', 'F8', 'T3', 'T4', 'T5', 'T6', 'Fz', 'Cz', 'Pz'
  ],
  sfreq: 256,
  n_samples: 256000,
  meas_date: '2026-02-01T00:00:00',
  patient_info: {
    patient_id: 'Test Patient',
    code: 'X',
    gender: 'X',
    birthdate: '01-Jan-2000',
    name: 'Test Patient'
  },
  n_annotations: 0,
  signals: [
    { label: 'Fp1', samples_per_record: 256, physical_min: -500, physical_max: 500 },
    { label: 'Fp2', samples_per_record: 256, physical_min: -500, physical_max: 500 },
    { label: 'F3', samples_per_record: 256, physical_min: -500, physical_max: 500 },
    { label: 'F4', samples_per_record: 256, physical_min: -500, physical_max: 500 },
    { label: 'C3', samples_per_record: 256, physical_min: -500, physical_max: 500 },
    { label: 'C4', samples_per_record: 256, physical_min: -500, physical_max: 500 },
    { label: 'P3', samples_per_record: 256, physical_min: -500, physical_max: 500 },
    { label: 'P4', samples_per_record: 256, physical_min: -500, physical_max: 500 },
    { label: 'O1', samples_per_record: 256, physical_min: -500, physical_max: 500 },
    { label: 'O2', samples_per_record: 256, physical_min: -500, physical_max: 500 },
    { label: 'F7', samples_per_record: 256, physical_min: -500, physical_max: 500 },
    { label: 'F8', samples_per_record: 256, physical_min: -500, physical_max: 500 },
    { label: 'T3', samples_per_record: 256, physical_min: -500, physical_max: 500 },
    { label: 'T4', samples_per_record: 256, physical_min: -500, physical_max: 500 },
    { label: 'T5', samples_per_record: 256, physical_min: -500, physical_max: 500 },
    { label: 'T6', samples_per_record: 256, physical_min: -500, physical_max: 500 },
    { label: 'Fz', samples_per_record: 256, physical_min: -500, physical_max: 500 },
    { label: 'Cz', samples_per_record: 256, physical_min: -500, physical_max: 500 },
    { label: 'Pz', samples_per_record: 256, physical_min: -500, physical_max: 500 },
  ],
};

/**
 * Mock waveform data for API mocking
 */
export function createMockWaveformData(numSamples: number = 2560): number[] {
  const data: number[] = [];
  for (let i = 0; i < numSamples; i++) {
    data.push(Math.sin(i / 10) * 100 + Math.random() * 10);
  }
  return data;
}
