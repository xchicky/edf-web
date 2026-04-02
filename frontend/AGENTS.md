# FRONTEND KNOWLEDGE BASE

**Generated:** 2026-01-29 22:11:49
**Commit:** 63294ec

## OVERVIEW
React 19.2 + TypeScript 5.9.3 + Vite 7.2.4 frontend for EEG waveform visualization with Zustand state management.

## STRUCTURE
```
frontend/
├── src/
│   ├── components/       # 15 React components (see components/AGENTS.md)
│   ├── api/              # Backend API client (edf.ts, signals.ts)
│   ├── store/            # Zustand global state (edfStore.ts)
│   ├── utils/            # Signal processing utilities
│   ├── types/            # TypeScript type definitions
│   ├── test/             # Test setup and utilities
│   ├── main.tsx          # Vite entry point (React 19 createRoot)
│   └── App.tsx           # Main app component (⚠️ 862 lines - needs refactoring)
├── vite.config.ts        # Minimal Vite config (no proxy)
├── vitest.config.ts      # Test config (80% coverage)
├── package.json          # Dependencies (React 19.2, Zustand 5.0.10)
└── Dockerfile            # Node.js 20 Alpine build
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Entry point | `src/main.tsx` | React 19 createRoot pattern |
| Main UI | `src/App.tsx` | ⚠️ Monolithic (862 lines) |
| State store | `src/store/edfStore.ts` | Zustand global state |
| API client | `src/api/edf.ts` | Axios-based backend client |
| Signal API | `src/api/signals.ts` | Signal validation/calculation |
| Waveform viz | `src/components/WaveformCanvas.tsx` | Canvas rendering |
| Build config | `vite.config.ts` | No proxy to backend |

## CONVENTIONS
### Frontend-Specific
- **State Management**: Zustand (no Context API)
- **Testing**: Vitest + jsdom + Testing Library
- **Coverage**: 80% minimum (v8 provider)
- **Build**: Vite with TypeScript compilation
- **Linting**: ESLint flat config (no Prettier)

### Development
```bash
npm run dev              # http://localhost:5173
npm run test             # Vitest
npm run test:coverage    # Coverage report
npm run build            # tsc -b && vite build
```

## ANTI-PATTERNS (FRONTEND)
- **NEVER commit with <80% test coverage**
- **NEVER use `as any` or `@ts-ignore`** (strict mode enforced)
- **NEVER put all logic in App.tsx** (split into components/hooks)
- **ALWAYS use canvas.width** for coordinate calcs (not rect.width)

## GOTCHAS
1. **No Vite proxy**: API calls go directly to localhost:8000 (should add proxy)
2. **Monolithic App.tsx**: Contains file upload, state, UI, keyboard shortcuts (needs splitting)
3. **Missing directories**: No pages/, hooks/, constants/ (standard in larger apps)
4. **Test utilities**: No src/test-utils/ or src/mocks/ directories

## DEPENDENCIES
- `react@19.2.0` - Latest React 19
- `typescript@~5.9.3` - Minor version pinned
- `vite@^7.2.4` - Build tool
- `zustand@^5.0.10` - State management
- `uplot@^1.6.32` - Waveform charts
- `@tanstack/react-query@^5.90.20` - Data fetching
- `axios@^1.13.2` - HTTP client
- `react-dropzone@^14.3.8` - File uploads
- `lodash.debounce@^4.0.8` - Debounce utility
