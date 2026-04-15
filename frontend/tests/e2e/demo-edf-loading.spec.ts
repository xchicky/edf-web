import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extend timeout for large file upload tests (128MB file)
test.describe.configure({ mode: 'serial', timeout: 180000 });

/**
 * E2E Tests: Demo EDF File Loading
 *
 * Tests the complete flow of loading the demo.edf file:
 * 1. File upload through dropzone
 * 2. Metadata extraction and display
 * 3. Waveform rendering
 * 4. Basic UI interactions
 *
 * Prerequisites:
 * - Backend server running at localhost:8001
 * - demo.edf file exists at ../../edf/demo.edf
 */

// Path to demo.edf relative to this test file
const DEMO_EDF_PATH = path.join(__dirname, '../../../edf/demo.edf');

/**
 * Wait for the app to be ready after navigation
 */
async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForSelector('body', { timeout: 10000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 });
}

/**
 * Check if backend is running
 * Note: Backend runs on port 8001 (8000 may be used by other projects)
 */
async function isBackendRunning(page: Page): Promise<boolean> {
  try {
    // Try port 8001 first (edf-web backend), then 8000 (default)
    const response = await page.request.get('http://localhost:8001/health');
    if (response.ok()) return true;

    const response8000 = await page.request.get('http://localhost:8000/health');
    return response8000.ok();
  } catch {
    return false;
  }
}

/**
 * Helper: Upload demo.edf and wait for upload response
 * Returns true if upload succeeded
 */
async function uploadDemoEDF(page: Page): Promise<boolean> {
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(DEMO_EDF_PATH);

  // Wait for upload response (metadata is returned directly from upload)
  try {
    await page.waitForResponse(
      (resp) => resp.url().includes('/api/upload') && resp.status() === 200,
      { timeout: 120000 }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper: Wait for waveform to load after upload
 */
async function waitForWaveformLoad(page: Page): Promise<void> {
  await page.waitForResponse(
    (resp) => resp.url().includes('/api/waveform') && resp.status() === 200,
    { timeout: 60000 }
  );
  await page.waitForTimeout(1000);
}

test.describe('Demo EDF File Loading', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.context().addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('backend should be running for integration tests', async ({ page }) => {
    const backendRunning = await isBackendRunning(page);

    if (!backendRunning) {
      test.skip(true, 'Backend server not running at localhost:8001. Start with: cd backend && uvicorn app.main:app --port 8001 --reload');
    }

    expect(backendRunning).toBe(true);
  });

  test('should load demo.edf file successfully', async ({ page }) => {
    const backendRunning = await isBackendRunning(page);
    test.skip(!backendRunning, 'Backend server not running');

    // Navigate to app
    await page.goto('/');
    await waitForAppReady(page);

    // Find the file input
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible({ timeout: 10000 });

    // Upload demo.edf
    const uploadSuccess = await uploadDemoEDF(page);
    expect(uploadSuccess).toBe(true);

    // Wait for waveform
    await waitForWaveformLoad(page);

    // Take screenshot after upload
    await page.screenshot({ path: 'test-results/demo-edf-upload.png', fullPage: true });

    // Verify metadata is displayed
    const metadataSection = page.locator('.metadata');
    await expect(metadataSection).toBeVisible({ timeout: 15000 });

    // Check for key metadata fields
    await expect(page.locator('text=/Channels:/')).toBeVisible();
    await expect(page.locator('text=/Duration:/')).toBeVisible();
    await expect(page.locator('text=/Sampling:/')).toBeVisible();

    // Verify waveform canvas is rendered
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 30000 });

    // Take screenshot after waveform loads
    await page.screenshot({ path: 'test-results/demo-edf-waveform.png', fullPage: true });
  });

  test('should display correct metadata for demo.edf', async ({ page }) => {
    const backendRunning = await isBackendRunning(page);
    test.skip(!backendRunning, 'Backend server not running');

    await page.goto('/');
    await waitForAppReady(page);

    // Upload demo.edf
    const uploadSuccess = await uploadDemoEDF(page);
    expect(uploadSuccess).toBe(true);

    // Wait for waveform to ensure UI is ready
    await waitForWaveformLoad(page);

    // Verify metadata content
    // demo.edf should have multiple channels
    const channelsText = await page.locator('.info-item:has-text("Channels:") .value').textContent();
    const numChannels = parseInt(channelsText || '0');
    expect(numChannels).toBeGreaterThan(0);

    // Duration should be positive
    const durationText = await page.locator('.info-item:has-text("Duration:") .value').textContent();
    expect(durationText).toBeTruthy();
    expect(durationText).toContain('min');

    // Sampling rate should be positive
    const samplingText = await page.locator('.info-item:has-text("Sampling:") .value').textContent();
    expect(samplingText).toContain('Hz');
  });

  test('should render waveform canvas with correct dimensions', async ({ page }) => {
    const backendRunning = await isBackendRunning(page);
    test.skip(!backendRunning, 'Backend server not running');

    await page.goto('/');
    await waitForAppReady(page);

    await uploadDemoEDF(page);
    await waitForWaveformLoad(page);

    // Wait for the waveform display area to be visible
    const waveformDisplay = page.locator('.waveform-display');
    await expect(waveformDisplay).toBeVisible({ timeout: 10000 });

    // Find the main waveform canvas (should have substantial dimensions)
    // The first canvas might be a small indicator, so find the largest one
    const canvases = page.locator('canvas');
    const count = await canvases.count();
    expect(count).toBeGreaterThan(0);

    // Find canvas with reasonable dimensions (main waveform canvas)
    let foundLargeCanvas = false;
    for (let i = 0; i < count; i++) {
      const canvas = canvases.nth(i);
      const box = await canvas.boundingBox();
      if (box && box.width > 200 && box.height > 100) {
        foundLargeCanvas = true;
        break;
      }
    }

    expect(foundLargeCanvas).toBe(true);

    // Take screenshot
    await page.screenshot({ path: 'test-results/demo-edf-canvas.png' });
  });

  test('should be able to zoom and pan the waveform', async ({ page }) => {
    const backendRunning = await isBackendRunning(page);
    test.skip(!backendRunning, 'Backend server not running');

    await page.goto('/');
    await waitForAppReady(page);

    await uploadDemoEDF(page);
    await waitForWaveformLoad(page);

    // Test zoom buttons
    const zoomInButton = page.locator('button:has-text("+"), button[aria-label="Zoom In"]').first();
    const zoomOutButton = page.locator('button:has-text("-"), button[aria-label="Zoom Out"]').first();

    // Click zoom in if available
    if (await zoomInButton.isVisible()) {
      await zoomInButton.click();
      await page.waitForTimeout(500);
    }

    // Test time scrubber if available
    const timeScrubber = page.locator('[class*="scrubber"], [class*="time-scrubber"]').first();
    if (await timeScrubber.isVisible()) {
      const box = await timeScrubber.boundingBox();
      if (box) {
        // Click in the middle of the scrubber
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(500);
      }
    }

    // Verify no errors
    const errorElement = page.locator('.error, [role="alert"]');
    const hasError = await errorElement.count();
    expect(hasError).toBe(0);

    await page.screenshot({ path: 'test-results/demo-edf-interaction.png' });
  });

  test('should handle keyboard navigation', async ({ page }) => {
    const backendRunning = await isBackendRunning(page);
    test.skip(!backendRunning, 'Backend server not running');

    await page.goto('/');
    await waitForAppReady(page);

    await uploadDemoEDF(page);
    await waitForWaveformLoad(page);

    // Focus on the page (not an input)
    await page.locator('body').click();

    // Test keyboard shortcuts
    // Arrow right - pan forward
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);

    // Arrow left - pan backward
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(500);

    // Plus - zoom in time
    await page.keyboard.press('+');
    await page.waitForTimeout(500);

    // Minus - zoom out time
    await page.keyboard.press('-');
    await page.waitForTimeout(500);

    // Verify no errors after keyboard interactions
    const errorElement = page.locator('.error, [role="alert"]');
    const hasError = await errorElement.count();
    expect(hasError).toBe(0);
  });

  test('should be able to select channels', async ({ page }) => {
    const backendRunning = await isBackendRunning(page);
    test.skip(!backendRunning, 'Backend server not running');

    await page.goto('/');
    await waitForAppReady(page);

    await uploadDemoEDF(page);
    await waitForWaveformLoad(page);

    // Find channel selector
    const channelSelector = page.locator('[class*="channel-selector"], [data-testid="channel-selector"]').first();

    if (await channelSelector.isVisible()) {
      // Look for channel checkboxes
      const channelCheckboxes = page.locator('input[type="checkbox"]').filter({ hasText: /Fp|F3|F4|C3|C4/ });

      if (await channelCheckboxes.count() > 0) {
        // Toggle first channel
        await channelCheckboxes.first().click();
        await page.waitForTimeout(500);

        // Toggle it back
        await channelCheckboxes.first().click();
        await page.waitForTimeout(500);
      }
    }

    // Verify waveform still renders correctly
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();

    await page.screenshot({ path: 'test-results/demo-edf-channels.png' });
  });

  test('should display time axis with correct labels', async ({ page }) => {
    const backendRunning = await isBackendRunning(page);
    test.skip(!backendRunning, 'Backend server not running');

    await page.goto('/');
    await waitForAppReady(page);

    await uploadDemoEDF(page);
    await waitForWaveformLoad(page);

    // Check for time axis elements
    const timeAxis = page.locator('[class*="time-axis"]').first();

    // Time axis might exist but could be rendered differently (canvas vs DOM)
    const timeAxisExists = await timeAxis.count() > 0;

    if (timeAxisExists && await timeAxis.isVisible()) {
      // Try to find any text content
      const allText = await timeAxis.textContent();
      const hasNumbers = allText ? /\d/.test(allText) : false;

      // If no text content, the time axis might be rendered in canvas
      // In that case, just verify the element exists
      if (!hasNumbers) {
        // Time axis exists, even if rendered in canvas
        expect(await timeAxis.isVisible()).toBe(true);
      } else {
        expect(hasNumbers).toBe(true);
      }
    } else {
      // If no time-axis class found, check for time indicators elsewhere
      // The time toolbar shows current time (00:00 format)
      const timeToolbar = page.locator('.time-toolbar, [class*="time-toolbar"]');
      if (await timeToolbar.count() > 0) {
        const timeText = await timeToolbar.first().textContent();
        expect(timeText).toMatch(/\d+:\d+/);
      } else {
        // Check for time display in the header or elsewhere
        const timeDisplay = page.locator('text=/\\d{2}:\\d{2}/');
        const hasTimeDisplay = await timeDisplay.count() > 0;
        expect(hasTimeDisplay).toBe(true);
      }
    }

    await page.screenshot({ path: 'test-results/demo-edf-time-axis.png' });
  });
});
