# E2E Testing Documentation

## Overview

End-to-end tests for the EEG/EDF Visualization application using Playwright. These tests verify critical user journeys across the full application stack.

## Test Structure

```
tests/e2e/
├── fixtures/
│   ├── EDFAppPage.ts       # Page Object Model
│   └── test-data.ts        # Test fixtures and helpers
├── file-upload.spec.ts      # File upload flow tests
├── waveform-interaction.spec.ts  # Waveform interaction tests
├── derived-signals.spec.ts  # Derived signal management tests
├── selection-analysis.spec.ts  # Selection and analysis tests
└── bookmarks.spec.ts        # Bookmark management tests
```

## Running Tests

### Prerequisites

1. Install dependencies:
```bash
npm install
```

2. Install Playwright browsers (if not already installed):
```bash
npx playwright install chromium
```

### Test Commands

```bash
# Run all E2E tests (headless)
npm run test:e2e

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Run with Playwright UI (interactive mode)
npm run test:e2e:ui

# Debug specific test
npm run test:e2e:debug -- file-upload.spec.ts

# Run specific test file
npx playwright test file-upload.spec.ts

# Run tests in specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# View HTML report
npm run test:e2e:report
```

### Configuration

Edit `playwright.config.ts` to configure:
- Base URL (default: http://localhost:5173)
- Browser types (Chromium, Firefox, WebKit)
- Timeouts and retries
- Artifacts (screenshots, videos, traces)

## Test Scenarios

### 1. File Upload Flow (`file-upload.spec.ts`)

Tests the complete file upload journey:

- Display dropzone on initial load
- Upload EDF file successfully
- Display metadata after upload
- Load and display waveform data
- Show error for invalid file type
- Handle large file upload gracefully
- Display file information

### 2. Waveform Interaction (`waveform-interaction.spec.ts`)

Tests user interactions with EEG waveform:

- Display waveform canvas
- Show time axis
- Show overview strip
- Support play/pause animation
- Support zoom in/out
- Display channel selector
- Support channel selection
- Support time scrubbing
- Display amplitude axis
- Show current time indicator
- Support keyboard navigation
- Maintain aspect ratio on resize
- Show zoom and resolution indicators
- Show interaction hints

### 3. Derived Signal Management (`derived-signals.spec.ts`)

Tests for creating and managing derived signals:

- Display signal list panel
- Have add signal button
- Open signal editor
- Create simple derived signal
- Validate expression
- Support signal toggle
- Delete signal
- Persist signals to localStorage
- Support expression builder
- Display derived signal in waveform

### 4. Selection and Analysis (`selection-analysis.spec.ts`)

Tests for time range selection and analysis:

- Support selection on waveform canvas
- Display selection info
- Have analysis panel
- Have time domain tab
- Have frequency domain tab
- Run time domain analysis
- Run frequency domain analysis
- Display statistics
- Clear selection
- Support multiple analysis types
- Show loading state during analysis

### 5. Bookmark Management (`bookmarks.spec.ts`)

Tests for creating and managing bookmarks:

- Have add bookmark button
- Add bookmark at current time
- Display bookmarks list
- Jump to bookmark
- Delete bookmark
- Persist bookmarks to localStorage
- Display bookmark time
- Support multiple bookmarks
- Have keyboard shortcut
- Show bookmark on waveform

## Page Object Model

The `EDFAppPage` class (in `fixtures/EDFAppPage.ts`) encapsulates all interactions with the application:

```typescript
import { EDFAppPage } from './fixtures/EDFAppPage';

test('my test', async ({ page }) => {
  const app = new EDFAppPage(page);
  await app.goto();
  await app.uploadEDFFile('test.edf');
  await app.waitForWaveform();
  await app.play();
  // ... more interactions
});
```

## Test Data

The `test-data.ts` fixture provides:

- `createTestEDFFile()` - Generate minimal EDF files for testing
- `TEST_EXPRESSIONS` - Common test expressions for derived signals
- `MOCK_METADATA` - Sample metadata for API mocking
- `createMockWaveformData()` - Generate sample waveform data

## Artifacts

Test artifacts are saved to:

- **Screenshots**: `test-results/screenshots/`
- **Videos**: `test-results/videos/`
- **Traces**: `test-results/traces/`
- **HTML Report**: `playwright-report/index.html`

## Best Practices

### 1. Use Page Object Model

```typescript
// Good
await edfApp.uploadEDFFile('test.edf');
await edfApp.waitForWaveform();

// Avoid
await page.locator('input[type="file"]').setInputFiles('test.edf');
await page.waitForTimeout(5000);
```

### 2. Wait for Conditions, Not Timeouts

```typescript
// Good
await expect(waveformCanvas).toBeVisible();
await page.waitForResponse(resp => resp.url().includes('/api/waveform'));

// Avoid
await page.waitForTimeout(5000);
```

### 3. Use Semantic Selectors

```typescript
// Good
await page.locator('[data-testid="add-signal"]').click();

// Avoid
await page.locator('button.btn-primary:nth-child(2)').click();
```

### 4. Handle Multiple Selectors

```typescript
// Good - provides fallbacks
const button = page.locator(
  'button:has-text("Add Signal"), ' +
  'button:has-text("New Signal"), ' +
  '[data-testid="add-signal"]'
);
```

### 5. Take Screenshots for Debugging

```typescript
await edfApp.screenshot('after-file-upload');
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

## Troubleshooting

### Tests Fail Locally

1. **Backend not running**: Start the FastAPI server
   ```bash
   cd backend
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

2. **Frontend not running**: Start the Vite dev server
   ```bash
   cd frontend
   npm run dev
   ```

3. **Port conflicts**: Update `BASE_URL` in playwright.config.ts

### Tests Are Flaky

1. **Increase timeout** in playwright.config.ts
2. **Use proper waits**: `waitForResponse()` instead of `waitForTimeout()`
3. **Check for race conditions**: Ensure animations complete before asserting

### Can't Find Elements

1. **Use browser dev tools**: Inspect the actual DOM
2. **Check for dynamic rendering**: Wait for elements to appear
3. **Add data-testid attributes**: Make elements easier to target

## Adding New Tests

1. Create test file in `tests/e2e/`
2. Import fixtures:
   ```typescript
   import { test, expect } from './fixtures/test-data';
   import { EDFAppPage } from './fixtures/EDFAppPage';
   ```

3. Write test:
   ```typescript
   test.describe('My Feature', () => {
     test('should do something', async ({ page }) => {
       const app = new EDFAppPage(page);
       await app.goto();
       // ... test implementation
     });
   });
   ```

4. Run test:
   ```bash
   npx playwright test my-feature.spec.ts
   ```

## Success Metrics

After E2E test run:

- All critical journeys passing (100%)
- Pass rate > 95% overall
- Flaky rate < 5%
- No failed tests blocking deployment
- Artifacts uploaded and accessible
- Test duration < 10 minutes
- HTML report generated

## References

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Page Object Model](https://playwright.dev/docs/pom)
