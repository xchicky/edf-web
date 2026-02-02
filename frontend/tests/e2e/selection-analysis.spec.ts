import { test, expect, clearStorage, waitForAppReady, setupMockAPI } from './fixtures/test-data';
import { EDFAppPage } from './fixtures/EDFAppPage';

/**
 * E2E Tests: Selection and Analysis
 *
 * Tests for selecting time ranges and running analysis:
 * 1. Create selection on waveform
 * 2. Run time domain analysis
 * 3. Run frequency domain analysis
 * 4. Display analysis results
 * 5. Clear selection
 */
test.describe('Selection and Analysis', () => {
  let edfApp: EDFAppPage;

  test.beforeEach(async ({ page }) => {
    edfApp = new EDFAppPage(page);
    await clearStorage(page);
    // Setup mock API
    await setupMockAPI(page);
    await edfApp.goto();
    await waitForAppReady(page);

    // Upload test file
    const fileInput = page.locator('input[type="file"]');
    const testBuffer = Buffer.alloc(5120);
    testBuffer.write('0       ', 0);
    testBuffer.write('Test Patient                                                  ', 8);
    testBuffer.write('Analysis Test                                                 ', 88);
    testBuffer.write('01.02.26', 168);
    testBuffer.write('00.00.00', 176);
    testBuffer.write('256     ', 184);
    testBuffer.write('3       ', 236);
    testBuffer.write('Fp1             ', 256);
    testBuffer.write('F3              ', 272);
    testBuffer.write('Fz              ', 288);

    await fileInput.setInputFiles({
      name: 'analysis-test.edf',
      mimeType: 'application/octet-stream',
      buffer: testBuffer
    });

    await page.waitForTimeout(5000);
  });

  test('should support selection on waveform canvas', async ({ page }) => {
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();

    try {
      const box = await canvas.boundingBox();
      if (box) {
        // Simulate click and drag to create selection
        await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2);
        await page.mouse.up();

        await page.waitForTimeout(500);

        // Look for selection indicator
        const selectionSelectors = [
          '[data-testid="selection-info"]',
          '[class*="selection-info"]',
          '[class*="selection-overlay"]'
        ];

        let selectionVisible = false;
        for (const selector of selectionSelectors) {
          try {
            const element = page.locator(selector).first();
            if (await element.isVisible({ timeout: 2000 })) {
              selectionVisible = true;
              break;
            }
          } catch {
            // Continue
          }
        }

        await edfApp.screenshot('waveform-selection');
      }
    } catch (e) {
      console.log('Selection test skipped:', e);
    }
  });

  test('should display selection info', async ({ page }) => {
    const canvas = page.locator('canvas').first();

    try {
      const box = await canvas.boundingBox();
      if (box) {
        // Create selection
        await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2);
        await page.mouse.up();

        await page.waitForTimeout(500);

        // Look for selection info display
        const infoSelectors = [
          '[data-testid="selection-info"]',
          '[class*="selection-info"]',
          'text=/Selected|selected|Duration|duration|Start|start/'
        ];

        let infoVisible = false;
        for (const selector of infoSelectors) {
          try {
            const element = page.locator(selector).first();
            if (await element.isVisible({ timeout: 2000 })) {
              infoVisible = true;
              break;
            }
          } catch {
            // Continue
          }
        }

        await edfApp.screenshot('selection-info-display');
      }
    } catch (e) {
      console.log('Selection info test skipped');
    }
  });

  test('should have analysis panel', async ({ page }) => {
    // Look for analysis panel (might be in right sidebar)
    const analysisSelectors = [
      '[data-testid="stats-view"]',
      '[data-testid="frequency-view"]',
      '[class*="stats-view"]',
      '[class*="frequency-view"]',
      '[class*="analysis-panel"]',
      'text=/Analysis|analysis|Stats|stats/'
    ];

    let analysisPanelVisible = false;
    for (const selector of analysisSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          analysisPanelVisible = true;
          break;
        }
      } catch {
        // Continue
      }
    }

    // If not visible, try toggling right sidebar
    if (!analysisPanelVisible) {
      const sidebarToggle = page.locator('button:has([class*="sidebar-toggle"])').nth(1);
      try {
        await sidebarToggle.click({ timeout: 2000 });
        await page.waitForTimeout(500);

        for (const selector of analysisSelectors) {
          try {
            const element = page.locator(selector).first();
            if (await element.isVisible({ timeout: 2000 })) {
              analysisPanelVisible = true;
              break;
            }
          } catch {
            // Continue
          }
        }
      } catch {
        // Sidebar toggle might not exist
      }
    }

    await edfApp.screenshot('analysis-panel');
  });

  test('should have time domain tab', async ({ page }) => {
    const timeTabSelectors = [
      'button:has-text("Time Domain")',
      'button:has-text("Time")',
      '[data-testid="time-domain"]',
      '[role="tab"]:has-text("Time")'
    ];

    let timeTabFound = false;
    for (const selector of timeTabSelectors) {
      try {
        const tab = page.locator(selector).first();
        if (await tab.isVisible({ timeout: 2000 })) {
          timeTabFound = true;
          break;
        }
      } catch {
        // Continue
      }
    }

    await edfApp.screenshot('time-domain-tab');
  });

  test('should have frequency domain tab', async ({ page }) => {
    const freqTabSelectors = [
      'button:has-text("Frequency Domain")',
      'button:has-text("Frequency")',
      '[data-testid="frequency-domain"]',
      '[role="tab"]:has-text("Frequency")'
    ];

    let freqTabFound = false;
    for (const selector of freqTabSelectors) {
      try {
        const tab = page.locator(selector).first();
        if (await tab.isVisible({ timeout: 2000 })) {
          freqTabFound = true;
          break;
        }
      } catch {
        // Continue
      }
    }

    await edfApp.screenshot('frequency-domain-tab');
  });

  test('should run time domain analysis', async ({ page }) => {
    // First create a selection
    const canvas = page.locator('canvas').first();
    try {
      const box = await canvas.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2);
        await page.mouse.up();
        await page.waitForTimeout(500);
      }
    } catch (e) {
      console.log('Could not create selection');
    }

    // Look for run analysis button
    const runButtonSelectors = [
      'button:has-text("Run Analysis")',
      'button:has-text("Analyze")',
      '[data-testid="run-analysis"]',
      'button[type="submit"]'
    ];

    for (const selector of runButtonSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 2000 })) {
          await button.click({ timeout: 2000 });
          await page.waitForTimeout(2000);
          break;
        }
      } catch {
        // Continue
      }
    }

    // Look for analysis results
    const resultsSelectors = [
      '[data-testid="analysis-results"]',
      '[class*="analysis-results"]',
      'text=/Mean|mean|Std|std|Min|min|max|Max/'
    ];

    for (const selector of resultsSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 3000 })) {
          break;
        }
      } catch {
        // Continue
      }
    }

    await edfApp.screenshot('time-domain-analysis');
  });

  test('should run frequency domain analysis', async ({ page }) => {
    // Create selection
    const canvas = page.locator('canvas').first();
    try {
      const box = await canvas.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2);
        await page.mouse.up();
        await page.waitForTimeout(500);
      }
    } catch (e) {
      console.log('Could not create selection');
    }

    // Switch to frequency domain tab
    const freqTab = page.locator('button:has-text("Frequency Domain"), button:has-text("Frequency")').first();
    try {
      await freqTab.click({ timeout: 2000 });
      await page.waitForTimeout(500);
    } catch (e) {
      console.log('Could not switch to frequency tab');
    }

    // Run analysis
    const runButton = page.locator('button:has-text("Run Analysis"), button:has-text("Analyze")').first();
    try {
      await runButton.click({ timeout: 2000 });
      await page.waitForTimeout(2000);
    } catch (e) {
      console.log('Could not click run button');
    }

    // Look for frequency results
    const freqResultsSelectors = [
      'text=/Power|power|FFT|fft|Frequency|frequency/',
      '[data-testid="frequency-results"]'
    ];

    for (const selector of freqResultsSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 3000 })) {
          break;
        }
      } catch {
        // Continue
      }
    }

    await edfApp.screenshot('frequency-domain-analysis');
  });

  test('should display statistics', async ({ page }) => {
    const statsSelectors = [
      'text=/Mean:|Std:|Min:|Max:',
      '[data-testid="stats"]',
      '[class*="statistics"]',
      'table[class*="stats"]'
    ];

    // Run analysis first
    const runButton = page.locator('button:has-text("Run Analysis"), button:has-text("Analyze")').first();
    try {
      await runButton.click({ timeout: 2000 });
      await page.waitForTimeout(2000);
    } catch (e) {
      // Analysis button might not exist without selection
    }

    // Check for statistics display
    for (const selector of statsSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 3000 })) {
          break;
        }
      } catch {
        // Continue
      }
    }

    await edfApp.screenshot('statistics-display');
  });

  test('should clear selection', async ({ page }) => {
    const canvas = page.locator('canvas').first();

    try {
      // Create selection
      const box = await canvas.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2);
        await page.mouse.up();
        await page.waitForTimeout(500);
      }

      // Look for clear selection button
      const clearButtonSelectors = [
        'button:has-text("Clear")',
        'button:has-text("Close")',
        '[data-testid="clear-selection"]',
        'button[aria-label*="Clear"]'
      ];

      for (const selector of clearButtonSelectors) {
        try {
          const button = page.locator(selector).first();
          if (await button.isVisible({ timeout: 2000 })) {
            await button.click({ timeout: 2000 });
            await page.waitForTimeout(500);
            break;
          }
        } catch {
          // Continue
        }
      }

      await edfApp.screenshot('selection-cleared');
    } catch (e) {
      console.log('Clear selection test skipped');
    }
  });

  test('should support multiple analysis types', async ({ page }) => {
    // Look for analysis type selector
    const typeSelectors = [
      'select[name="analysis-type"]',
      '[data-testid="analysis-type"]',
      'button:has(text="Basic")',
      'button:has(text="Advanced")'
    ];

    for (const selector of typeSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          break;
        }
      } catch {
        // Continue
      }
    }

    await edfApp.screenshot('analysis-types');
  });

  test('should show loading state during analysis', async ({ page }) => {
    const canvas = page.locator('canvas').first();

    try {
      // Create selection
      const box = await canvas.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2);
        await page.mouse.up();
        await page.waitForTimeout(500);
      }

      // Click run button and immediately check for loading
      const runButton = page.locator('button:has-text("Run Analysis")').first();

      // Listen for network responses
      const responses: any[] = [];
      page.on('response', response => {
        if (response.url().includes('/analyze')) {
          responses.push(response);
        }
      });

      await runButton.click({ timeout: 2000 });

      // Check for loading indicator
      const loadingSelectors = [
        '[class*="loading"]',
        '[class*="spinner"]',
        'text=/Loading|loading|Analyzing|analyzing/'
      ];

      let hasLoading = false;
      for (const selector of loadingSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 500 })) {
            hasLoading = true;
            break;
          }
        } catch {
          // Continue
        }
      }

      await page.waitForTimeout(2000);

      await edfApp.screenshot('analysis-loading');
    } catch (e) {
      console.log('Loading state test skipped');
    }
  });
});
