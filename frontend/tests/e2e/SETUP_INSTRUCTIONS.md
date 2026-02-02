# E2E Testing Setup - Completion Instructions

## What Has Been Completed

The E2E testing framework has been successfully set up with:

### Files Created

**Configuration:**
- `/frontend/playwright.config.ts` - Playwright configuration
- `/frontend/package.json` - Updated with E2E test scripts

**Test Infrastructure:**
- `/frontend/tests/e2e/fixtures/EDFAppPage.ts` - Page Object Model (275 lines)
- `/frontend/tests/e2e/fixtures/test-data.ts` - Test fixtures and helpers

**Test Suites (48 tests across 5 files):**
1. `file-upload.spec.ts` - 7 tests for file upload flow
2. `waveform-interaction.spec.ts` - 13 tests for waveform interaction
3. `derived-signals.spec.ts` - 9 tests for signal management
4. `selection-analysis.spec.ts` - 10 tests for selection & analysis
5. `bookmarks.spec.ts` - 9 tests for bookmark management

**Documentation:**
- `/frontend/tests/e2e/README.md` - Comprehensive documentation
- `/frontend/tests/e2e/QUICKSTART.md` - Quick start guide
- `/frontend/tests/e2e/SUMMARY.md` - Implementation summary

## Remaining Steps

### 1. Install Playwright Browsers

Due to network issues during the initial setup, the browser installation needs to be completed manually. Run one of the following commands:

**Option A: Install all browsers**
```bash
cd /Users/yizhang/Workspace/App/edf-web/frontend
npx playwright install
```

**Option B: Install only Chromium (faster)**
```bash
cd /Users/yizhang/Workspace/App/edf-web/frontend
npx playwright install chromium
```

**If the download fails, try:**
```bash
# Increase timeout
PLAYWRIGHT_DOWNLOAD_TIMEOUT=120000 npx playwright install chromium

# Or use a different mirror
PLAYWRIGHT_DOWNLOAD_HOST=https://playwright.azureedge.net npx playwright install chromium
```

### 2. Verify Installation

```bash
npx playwright --version
# Should output: Version 1.58.1
```

### 3. Run Tests

**Make sure the backend server is running:**
```bash
cd /Users/yizhang/Workspace/App/edf-web/backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**In a new terminal, run the E2E tests:**
```bash
cd /Users/yizhang/Workspace/App/edf-web/frontend

# Run all tests
npm run test:e2e

# Or run specific test file
npx playwright test file-upload.spec.ts

# Or run with UI mode (recommended for first run)
npm run test:e2e:ui
```

## Troubleshooting

### Issue: Browser download fails

**Solution:**
1. Check your internet connection
2. Try downloading from a different network
3. Use the `--dry-run` flag to list tests without running them:
   ```bash
   npx playwright test --list
   ```

### Issue: Tests fail to connect to server

**Solution:**
1. Make sure the backend is running on port 8000
2. Make sure the frontend dev server is running on port 5173
3. Or let Playwright auto-start the frontend server (configured in playwright.config.ts)

### Issue: Tests timeout

**Solution:**
1. Increase timeout in `playwright.config.ts`:
   ```typescript
   use: {
     actionTimeout: 20000,
     navigationTimeout: 60000,
   }
   ```

### Issue: Tests can't find elements

**Solution:**
1. Run tests in headed mode to see what's happening:
   ```bash
   npm run test:e2e:headed
   ```
2. Check the screenshots in `test-results/screenshots/`
3. Add `data-testid` attributes to React components for more reliable selectors

## Test Coverage Summary

| Feature | Test File | Tests |
|---------|-----------|-------|
| File Upload | `file-upload.spec.ts` | 7 |
| Waveform Display | `waveform-interaction.spec.ts` | 13 |
| Derived Signals | `derived-signals.spec.ts` | 9 |
| Selection/Analysis | `selection-analysis.spec.ts` | 10 |
| Bookmarks | `bookmarks.spec.ts` | 9 |
| **Total** | **5 files** | **48 tests** |

## NPM Commands Available

```bash
npm run test:e2e           # Run all E2E tests
npm run test:e2e:ui        # Run with Playwright UI
npm run test:e2e:debug     # Debug mode with inspector
npm run test:e2e:headed    # Run in headed mode
npm run test:e2e:report    # View HTML report
```

## Viewing Results

After tests run:

```bash
# View HTML report
open playwright-report/index.html

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
          retention-days: 30
```

## Next Steps After Running Tests

1. **Fix any failing tests** - Review the HTML report to identify issues
2. **Add data-testid attributes** - Update React components with test IDs for more reliable selectors
3. **Adjust timeouts** - Fine-tune timeout values based on actual test performance
4. **Add visual regression tests** - Consider adding screenshot comparison tests
5. **Set up CI/CD** - Configure automated testing on PRs

## Documentation

- Full documentation: `/frontend/tests/e2e/README.md`
- Quick start guide: `/frontend/tests/e2e/QUICKSTART.md`
- Implementation summary: `/frontend/tests/e2e/SUMMARY.md`

## Support

For issues or questions:
- [Playwright Documentation](https://playwright.dev)
- [Playwright Troubleshooting](https://playwright.dev/docs/browsers)
- Check the HTML report after test runs for detailed error information
