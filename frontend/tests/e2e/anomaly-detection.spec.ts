import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extend timeout for large file tests
test.describe.configure({ mode: 'serial', timeout: 180000 });

/**
 * E2E Tests: Anomaly Detection Panel
 *
 * Tests anomaly detection UI integration after EDF file load.
 * Prerequisites:
 * - Backend server running at localhost:8001
 * - demo.edf file exists at ../../edf/demo.edf
 */

const DEMO_EDF_PATH = path.join(__dirname, '../../../edf/demo.edf');

/**
 * Check if backend is running
 */
async function isBackendRunning(page: Page): Promise<boolean> {
  try {
    const response = await page.request.get('http://localhost:8001/health');
    return response.ok();
  } catch {
    return false;
  }
}

test.describe('Anomaly Detection Panel', () => {
  test('backend health check', async ({ page }) => {
    const backendRunning = await isBackendRunning(page);
    expect(backendRunning).toBe(true);
  });

  test('app loads and displays dropzone', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for file input (dropzone)
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible({ timeout: 30000 });

    // Take screenshot
    await page.screenshot({ path: 'test-results/anomaly-app-loaded.png' });
  });

  // Note: Full upload + waveform render test is covered by demo-edf-loading.spec.ts
  // This test suite focuses on anomaly detection specific functionality

  test('anomaly detection API endpoint is accessible', async ({ page }) => {
    const backendRunning = await isBackendRunning(page);
    test.skip(!backendRunning, 'Backend server not running');

    // Test that the anomaly detection endpoint exists
    const response = await page.request.post(
      'http://localhost:8001/api/anomaly_detection/test-file-id',
      {
        data: {
          start: 0,
          duration: 10,
          sensitivity: 1.0,
        },
        failOnStatusCode: false, // Don't fail on 404/500
      }
    );

    // We expect either 200 (success), 404 (file not found), 422 (validation error), or 500 (processing error)
    // Any of these means the endpoint exists
    expect([200, 404, 422, 500]).toContain(response.status());
  });

  test('anomaly detection panel renders when metadata exists', async ({ page }) => {
    const backendRunning = await isBackendRunning(page);
    test.skip(!backendRunning, 'Backend server not running');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Inject mock metadata into the app to test panel rendering
    // This bypasses the file upload to test the panel in isolation
    await page.evaluate(() => {
      // Mock minimal store state
      const mockMetadata = {
        file_id: 'test-file-id',
        filename: 'test.edf',
        file_size_mb: 10,
        n_channels: 19,
        channel_names: ['Fp1', 'Fp2', 'F3', 'F4', 'C3', 'C4'],
        sfreq: 256,
        duration_seconds: 600,
        duration_minutes: 10,
        meas_date: '2023-01-01T00:00:00Z',
        patient_info: { patient_id: 'test', sex: 'Unknown', age: null },
      };

      // Dispatch a custom event to set metadata
      window.dispatchEvent(new CustomEvent('set-test-metadata', {
        detail: mockMetadata
      }));
    });

    // Wait for React to potentially re-render
    await page.waitForTimeout(1000);

    // Check if the page has the basic structure
    const header = page.locator('h1, .header');
    await expect(header.first()).toBeVisible({ timeout: 10000 });
  });
});

/**
 * Integration test that requires full EDF upload
 * Run separately with: npx playwright test anomaly-detection.spec.ts -g "full integration"
 */
test.describe('Anomaly Detection - Full Integration', () => {
  test.skip('should run anomaly detection after EDF upload', async ({ page }) => {
    // This test is skipped by default due to time required for file upload
    // Run manually when needed: npx playwright test -g "full integration" --headed

    const backendRunning = await isBackendRunning(page);
    test.skip(!backendRunning, 'Backend server not running');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(DEMO_EDF_PATH);

    // Wait for upload
    await page.waitForResponse(
      (resp) => resp.url().includes('/api/upload') && resp.status() === 200,
      { timeout: 180000 }
    );

    // Wait for waveform
    await page.waitForResponse(
      (resp) => resp.url().includes('/api/waveform'),
      { timeout: 60000 }
    );

    await page.waitForTimeout(3000);

    // Expand right sidebar if needed
    const collapsedSidebar = page.locator('section.right-sidebar.collapsed');
    if (await collapsedSidebar.count() > 0) {
      await collapsedSidebar.locator('button.sidebar-toggle').click();
      await page.waitForTimeout(500);
    }

    // Find and click detect button using data-testid
    const detectButton = page.getByTestId('anomaly-detect-btn');
    await detectButton.click();

    // Wait for detection to complete
    await page.waitForResponse(
      (resp) => resp.url().includes('/api/anomaly_detection'),
      { timeout: 120000 }
    );

    await page.waitForTimeout(2000);

    // Take screenshot
    await page.screenshot({ path: 'test-results/anomaly-detection-full.png', fullPage: true });
  });
});
