import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for EEG/EDF Visualization Application
 *
 * Encapsulates all interactions with the main application interface
 */
export class EDFAppPage {
  readonly page: Page;

  // Main UI elements
  readonly dropzone: Locator;
  readonly metadataDisplay: Locator;
  readonly waveformCanvas: Locator;
  readonly overviewStrip: Locator;
  readonly timeScrubber: Locator;

  // Controls
  readonly playButton: Locator;
  readonly pauseButton: Locator;
  readonly zoomInButton: Locator;
  readonly zoomOutButton: Locator;
  readonly channelSelector: Locator;

  // Sidebars
  readonly leftSidebarToggle: Locator;
  readonly rightSidebarToggle: Locator;
  readonly signalListPanel: Locator;
  readonly signalEditorButton: Locator;
  readonly statsViewPanel: Locator;

  // Signal management
  readonly signalNameInput: Locator;
  readonly signalExpressionInput: Locator;
  readonly signalSaveButton: Locator;
  readonly signalCancelButton: Locator;

  // Selection and analysis
  readonly selectionInfo: Locator;
  readonly runAnalysisButton: Locator;
  readonly analysisTypeSelect: Locator;
  readonly timeDomainTab: Locator;
  readonly frequencyDomainTab: Locator;

  // Bookmarks
  readonly bookmarkButton: Locator;
  readonly bookmarksList: Locator;

  // Time axis
  readonly timeAxis: Locator;
  readonly currentTimeIndicator: Locator;

  constructor(page: Page) {
    this.page = page;

    // Main UI
    this.dropzone = page.locator('[class*="dropzone"], [data-testid="dropzone"]');
    this.metadataDisplay = page.locator('[data-testid="metadata-display"], .metadata');
    this.waveformCanvas = page.locator('canvas').first();
    this.overviewStrip = page.locator('[class*="overview"]');
    this.timeScrubber = page.locator('[class*="scrubber"]');

    // Controls - look for buttons with icons or labels
    this.playButton = page.locator('button:has-text("Play"), button[aria-label="Play"], button:has([class*="play"])');
    this.pauseButton = page.locator('button:has-text("Pause"), button[aria-label="Pause"], button:has([class*="pause"])');
    this.zoomInButton = page.locator('button[aria-label="Zoom In"], button:has([class*="zoom-in"])');
    this.zoomOutButton = page.locator('button[aria-label="Zoom Out"], button:has([class*="zoom-out"])');
    this.channelSelector = page.locator('[data-testid="channel-selector"], [class*="channel-selector"]');

    // Sidebars
    this.leftSidebarToggle = page.locator('button:has([class*="sidebar-toggle"]), [aria-label="Toggle Left Sidebar"]');
    this.rightSidebarToggle = page.locator('button:has([class*="sidebar-toggle"])').nth(1);
    this.signalListPanel = page.locator('[data-testid="signal-list"], [class*="signal-list"]');
    this.signalEditorButton = page.locator('button:has-text("Add Signal"), button:has-text("New Signal"), [data-testid="add-signal"]');
    this.statsViewPanel = page.locator('[data-testid="stats-view"], [class*="stats-view"]');

    // Signal editor
    this.signalNameInput = page.locator('input[name="name"], input[placeholder*="name"], #signal-name');
    this.signalExpressionInput = page.locator('input[name="expression"], textarea[name="expression"], #signal-expression');
    this.signalSaveButton = page.locator('button:has-text("Save"), button:has-text("Create"), [data-testid="save-signal"]');
    this.signalCancelButton = page.locator('button:has-text("Cancel"), button:has-text("Close")');

    // Selection and analysis
    this.selectionInfo = page.locator('[data-testid="selection-info"], [class*="selection-info"]');
    this.runAnalysisButton = page.locator('button:has-text("Run Analysis"), [data-testid="run-analysis"]');
    this.analysisTypeSelect = page.locator('select[name="analysis-type"], [data-testid="analysis-type"]');
    this.timeDomainTab = page.locator('button:has-text("Time Domain"), [data-testid="time-domain"]');
    this.frequencyDomainTab = page.locator('button:has-text("Frequency Domain"), [data-testid="frequency-domain"]');

    // Bookmarks
    this.bookmarkButton = page.locator('button:has-text("Bookmark"), button[aria-label="Add Bookmark"], [data-testid="add-bookmark"]');
    this.bookmarksList = page.locator('[data-testid="bookmarks-list"], [class*="bookmarks-list"]');

    // Time
    this.timeAxis = page.locator('[class*="time-axis"]');
    this.currentTimeIndicator = page.locator('[class*="time-indicator"], [data-testid="current-time"]');
  }

  /**
   * Navigate to the application
   */
  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Upload an EDF file
   */
  async uploadEDFFile(filePath: string) {
    // Check if dropzone is present
    const hasDropzone = await this.dropzone.count() > 0;

    if (hasDropzone) {
      // Use dropzone upload
      const fileInput = this.page.locator('input[type="file"]');
      await fileInput.setInputFiles(filePath);
    } else {
      // Alternative: use the file input directly
      const fileInput = this.page.locator('input[type="file"]');
      await fileInput.setInputFiles(filePath);
    }

    // Wait for metadata to load
    await this.page.waitForResponse(resp =>
      resp.url().includes('/api/metadata') || resp.url().includes('/upload')
    );
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for waveform to be visible and loaded
   */
  async waitForWaveform() {
    await expect(this.waveformCanvas).toBeVisible({ timeout: 15000 });
    // Wait for waveform data to load (check for API response)
    await this.page.waitForResponse(resp =>
      resp.url().includes('/api/waveform'), { timeout: 15000 }
    ).catch(() => {
      // If waveform is already visible but no new API calls, that's okay
      console.log('Waveform may already be loaded');
    });
  }

  /**
   * Get metadata information
   */
  async getMetadata() {
    const text = await this.metadataDisplay.textContent();
    return text || '';
  }

  /**
   * Play the waveform animation
   */
  async play() {
    await this.playButton.click();
    // Wait a moment for playback to start
    await this.page.waitForTimeout(500);
  }

  /**
   * Pause the waveform animation
   */
  async pause() {
    await this.pauseButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Zoom in
   */
  async zoomIn() {
    await this.zoomInButton.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Zoom out
   */
  async zoomOut() {
    await this.zoomOutButton.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Toggle left sidebar (signal list)
   */
  async toggleLeftSidebar() {
    await this.leftSidebarToggle.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Toggle right sidebar (analysis panel)
   */
  async toggleRightSidebar() {
    await this.rightSidebarToggle.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Create a new derived signal
   */
  async createSignal(name: string, expression: string) {
    // Ensure signal list panel is open
    const isPanelVisible = await this.signalListPanel.isVisible().catch(() => false);
    if (!isPanelVisible) {
      await this.toggleLeftSidebar();
    }

    // Click add signal button
    await this.signalEditorButton.click();

    // Wait for signal editor to appear
    await this.page.waitForTimeout(500);

    // Fill in signal details
    await this.signalNameInput.fill(name);
    await this.signalExpressionInput.fill(expression);

    // Save the signal
    await this.signalSaveButton.click();

    // Wait for signal to be created
    await this.page.waitForTimeout(500);
  }

  /**
   * Select a channel
   */
  async selectChannel(channelName: string) {
    const channelCheckbox = this.page.locator(`[data-channel="${channelName}"], label:has-text("${channelName}")`);
    await channelCheckbox.click();
  }

  /**
   * Drag the time scrubber to navigate
   */
  async dragTimeScrubber(targetPosition: number) {
    const box = await this.timeScrubber.boundingBox();
    if (!box) throw new Error('Time scrubber not found');

    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(box.x + targetPosition, box.y + box.height / 2);
    await this.page.mouse.up();

    await this.page.waitForTimeout(500);
  }

  /**
   * Create a selection on the waveform
   */
  async createSelection(startX: number, endX: number) {
    const box = await this.waveformCanvas.boundingBox();
    if (!box) throw new Error('Waveform canvas not found');

    // Start selection
    await this.page.mouse.move(box.x + startX, box.y + box.height / 2);
    await this.page.mouse.down();

    // Drag to end position
    await this.page.mouse.move(box.x + endX, box.y + box.height / 2);
    await this.page.mouse.up();

    await this.page.waitForTimeout(500);
  }

  /**
   * Run analysis on current selection
   */
  async runAnalysis(type: 'time' | 'frequency') {
    // Ensure analysis panel is open
    const isPanelVisible = await this.statsViewPanel.isVisible().catch(() => false);
    if (!isPanelVisible) {
      await this.toggleRightSidebar();
    }

    // Select analysis type
    if (type === 'time') {
      await this.timeDomainTab.click();
    } else {
      await this.frequencyDomainTab.click();
    }

    // Run analysis
    await this.runAnalysisButton.click();

    // Wait for analysis to complete
    await this.page.waitForResponse(resp =>
      resp.url().includes('/api/analyze')
    , { timeout: 30000 });

    await this.page.waitForTimeout(1000);
  }

  /**
   * Add a bookmark at current time
   */
  async addBookmark() {
    await this.bookmarkButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Jump to a specific bookmark
   */
  async jumpToBookmark(index: number) {
    const bookmarkItems = this.bookmarksList.locator('[class*="bookmark-item"], button');
    await bookmarkItems.nth(index).click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Get current time position
   */
  async getCurrentTime(): Promise<number> {
    const timeText = await this.currentTimeIndicator.textContent();
    if (!timeText) return 0;
    // Parse time value (format may vary)
    const match = timeText.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  }

  /**
   * Take a screenshot with descriptive name
   */
  async screenshot(name: string) {
    await this.page.screenshot({
      path: `test-results/screenshots/${name}.png`,
      fullPage: true
    });
  }

  /**
   * Check if there's an error displayed
   */
  async hasError(): Promise<boolean> {
    const errorLocator = this.page.locator('[role="alert"], .error, [class*="error"]');
    return await errorLocator.count() > 0;
  }

  /**
   * Get error message if present
   */
  async getErrorMessage(): Promise<string | null> {
    const errorLocator = this.page.locator('[role="alert"], .error, [class*="error"]');
    if (await errorLocator.count() > 0) {
      return await errorLocator.first().textContent();
    }
    return null;
  }
}
