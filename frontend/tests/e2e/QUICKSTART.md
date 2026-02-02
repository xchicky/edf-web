# E2E Testing Quick Start Guide

## Setup (One-Time)

### 1. Install Playwright

```bash
cd frontend
npm install --save-dev @playwright/test
```

### 2. Install Browsers

```bash
npx playwright install chromium
```

For all browsers:
```bash
npx playwright install
```

### 3. Verify Installation

```bash
npx playwright --version
```

## Running Tests

### Option 1: With Auto-Start Web Server (Recommended)

Playwright config is set up to automatically start the dev server:

```bash
npm run test:e2e
```

### Option 2: Manual Server Start

If you prefer to start servers manually:

```bash
# Terminal 1: Start backend
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Start frontend
cd frontend
npm run dev

# Terminal 3: Run tests
npm run test:e2e
```

### Option 3: Against Running Server

If servers are already running:

```bash
BASE_URL=http://localhost:5173 npm run test:e2e
```

## Test Commands

| Command | Description |
|---------|-------------|
| `npm run test:e2e` | Run all tests (headless) |
| `npm run test:e2e:ui` | Run with Playwright UI |
| `npm run test:e2e:headed` | Run in headed mode (see browser) |
| `npm run test:e2e:debug` | Debug mode with inspector |
| `npm run test:e2e:report` | Open HTML report |

## Test Files

| File | Tests |
|------|-------|
| `file-upload.spec.ts` | 7 tests for file upload flow |
| `waveform-interaction.spec.ts` | 13 tests for waveform interaction |
| `derived-signals.spec.ts` | 9 tests for signal management |
| `selection-analysis.spec.ts` | 10 tests for selection & analysis |
| `bookmarks.spec.ts` | 9 tests for bookmark management |

## Common Issues

### Issue: "Server not running"

**Solution**: The test should auto-start the server. If it fails, start manually:

```bash
cd frontend && npm run dev
```

### Issue: "Browser not found"

**Solution**: Install Playwright browsers:

```bash
npx playwright install chromium
```

### Issue: Tests timeout

**Solution**: Increase timeout in `playwright.config.ts`:

```typescript
use: {
  actionTimeout: 20000,  // Increase from 10000
  navigationTimeout: 60000,  // Increase from 30000
}
```

### Issue: Flaky tests

**Solution**: Run with retries:

```bash
npx playwright test --retries=3
```

## Viewing Results

After tests run:

```bash
# View HTML report
npm run test:e2e:report

# View screenshots
open test-results/screenshots/

# View traces (if enabled)
npx playwright show-trace test-results/traces/
```

## CI/CD Integration

Add to `.github/workflows/e2e.yml`:

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

      - name: Install Playwright
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

## Writing New Tests

1. Create test file: `tests/e2e/my-feature.spec.ts`

2. Use Page Object Model:

```typescript
import { test, expect } from './fixtures/test-data';
import { EDFAppPage } from './fixtures/EDFAppPage';

test.describe('My Feature', () => {
  test('should work', async ({ page }) => {
    const app = new EDFAppPage(page);
    await app.goto();
    // ... test implementation
  });
});
```

3. Run the test:

```bash
npx playwright test my-feature.spec.ts
```

## Resources

- Full documentation: `tests/e2e/README.md`
- [Playwright Docs](https://playwright.dev)
- Page Object Model: `tests/e2e/fixtures/EDFAppPage.ts`
