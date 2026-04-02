# PROJECT KNOWLEDGE BASE

**Generated:** 2026-01-29 22:11:49
**Commit:** 63294ec
**Branch:** main

## OVERVIEW
Web application for visualizing EEG/EDF medical data with React 19 + FastAPI backend. Specialized in memory-optimized large file processing (100MB+ EDF files) with support for derived signal calculations.

## STRUCTURE
```
edf-web/
├── frontend/          # React 19.2 + TypeScript + Vite frontend
│   └── src/
│       ├── components/   # 15 React components (WaveformCanvas core)
│       ├── api/          # Backend API client (edf.ts, signals.ts)
│       ├── store/        # Zustand state management (edfStore.ts)
│       ├── utils/        # Signal processing utilities
│       └── types/        # TypeScript type definitions
├── backend/           # FastAPI + MNE-Python backend
│   └── app/
│       ├── api/routes/  # 7 REST API endpoints
│       ├── services/    # EDF parsing, file management, signal calculation
│       └── utils/       # Helper utilities
├── storage/           # EDF file storage (uploads)
└── edf/               # Sample EDF files
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Frontend entry point | `frontend/src/main.tsx` | React 19 createRoot |
| Main UI component | `frontend/src/App.tsx` | ⚠️ 862 lines - needs refactoring |
| Waveform rendering | `frontend/src/components/WaveformCanvas.tsx` | Canvas-based visualization |
| Backend entry | `backend/app/main.py` | FastAPI with CORS |
| EDF parsing | `backend/app/services/edf_parser.py` | MNE-Python integration |
| Memory optimization | `backend/app/services/edf_parser.py` | preload=False + crop() strategy |
| Signal calculation | `backend/app/services/signal_calculator.py` | Derived signal computation |
| API contracts | `frontend/src/api/edf.ts` ↔ `backend/app/api/routes/` | REST endpoints |

## CONVENTIONS
### Code Standards
- **Test coverage**: 80% minimum (both frontend Vitest + backend Pytest)
- **TypeScript strict mode**: Enabled (noUnusedLocals, noUnusedParameters)
- **ESLint**: Flat config with TypeScript ESLint (no Prettier)
- **Python versioning**: Exact pinning in requirements.txt (MNE 1.11.0, NOT 1.6.0)

### Git Commits
Conventional Commits format:
- `feat:` - New features
- `fix:` - Bug fixes
- `test:` - Test additions
- `style:` - Styling improvements
- `docs:` - Documentation

## ANTI-PATTERNS (THIS PROJECT)
- **NEVER use `preload=True`** for EDF files → Always use `preload=False` + `crop()` + `load_data()`
- **NEVER commit without 80% coverage** → CI/CD gates enforce this
- **NEVER use MNE 1.6.0** → Use 1.11.0 (scipy compatibility issue)
- **NEVER suppress type errors** → No `as any`, `@ts-ignore` allowed
- **ALWAYS use `encoding='latin1'`** when reading EDF files (Chinese filename support)

## CRITICAL ARCHITECTURAL DECISIONS

### Memory Optimization Strategy
**Problem**: 176MB EDF file → 240MB RAM when fully loaded
**Solution**:
```python
# Step 1: Lazy load
raw = mne.io.read_raw_edf(file_path, preload=False, encoding='latin1')
# Step 2: Crop time window
raw.crop(tmin=start_time, tmax=end_time)
# Step 3: Select channels
raw.pick_channels(selected_channels)
# Step 4: Load to memory
raw.load_data()
```
**Result**: 10s × 10 channels = 2MB (99% reduction)

### Derived Signal System (Phase 1)
**Concept**: Compute new signals from raw EEG channels using mathematical expressions

**Supported Operations**:
- Arithmetic: `+`, `-`, `*`, `/`, `()`
- NumPy functions: `np.abs()`, `np.mean()`, `np.std()`, `np.min()`, `np.max()`, `np.sum()`, `np.sqrt()`, `np.log()`, `np.exp()`

**Expression Examples**:
```
Fp1 - F3              # Difference
(Fp1 + F3) / 2        # Average
np.abs(Fp1 - F3)      # Absolute difference
```

**Architecture**:
- Frontend: Expression validation, signal editor UI, localStorage persistence
- Backend: Safe expression evaluation, memory-optimized calculation
- Integration: Signals merged with raw waveforms in WaveformCanvas

### Frontend State Management
- **Store**: Zustand in `frontend/src/store/edfStore.ts`
- **State**: metadata, waveform data, currentTime, selectedChannels, windowDuration, amplitudeScale, bookmarks, **signals**, **signalData**
- **Pattern**: Single global store (no context providers)

### Backend Three-Layer Architecture
```
API Routes (backend/app/api/routes/)
    ↓ calls
Services Layer (backend/app/services/)
    ↓ uses
MNE-Python Library (EDF parsing)
```

## COMMANDS
```bash
# Frontend development
cd frontend && npm run dev          # http://localhost:5173
npm run test                       # Vitest with coverage
npm run build                      # TypeScript + Vite build

# Backend development
cd backend && uvicorn app.main:app --reload
pytest --cov=app                   # Pytest with 80% coverage gate

# Docker (recommended)
docker-compose up -d               # Full stack
docker-compose logs -f             # View logs
```

## GOTCHAS
1. **Duplicate storage directories**: `/storage/uploads/` AND `/backend/storage/uploads/` → Use backend/ version
2. **Monolithic App.tsx**: 862 lines - contains all UI logic, needs splitting into components/hooks
3. **No Vite proxy config**: Backend API calls go directly to localhost:8000 (should add proxy)
4. **Backend `--reload` in Docker**: Uses dev mode in production containers (intentional for debugging)
5. **Chinese filenames**: Require `encoding='latin1'` parameter in MNE-Python
6. **No .env files in repo**: Only .env.example templates provided
7. **Signal expression limit**: Max 500 characters, must reference valid channels

## DEPENDENCY VERSION NOTES
- **MNE**: 1.11.0 (NOT 1.6.0 - scipy 1.17.0 incompatibility)
- **React**: 19.2.0 (latest with createRoot API)
- **FastAPI**: 0.104.1 (pinned, not latest)
- **TypeScript**: 5.9.3 with strict mode enabled
- **Vite**: 7.2.4 (latest)
- **Zustand**: 5.0.10 for state management
- **uPlot**: 1.6.32 for waveform charts (not Chart.js)
- **React Query**: 5.90.20 for data fetching
- **Axios**: 1.13.2 for HTTP client

## TESTING
- **Frontend**: Vitest + jsdom + Testing Library + @vitest/coverage-v8
- **Backend**: Pytest + pytest-asyncio + pytest-cov + httpx
- **Coverage thresholds**: 80% for statements/branches/functions/lines (both)
- **Test location**: Co-located `__tests__/` directories next to source files

## DOCUMENTATION
- `CLAUDE.md` - Comprehensive project guide (1342 lines - primary reference)
- `README.md` - User-facing features and quick start
- `TECHNICAL_RECOMMENDATIONS.md` - Technical architecture notes
- `frontend/AGENTS.md` - Frontend-specific knowledge
- `backend/AGENTS.md` - Backend-specific knowledge
- `frontend/src/components/AGENTS.md` - Component architecture
- `backend/app/api/routes/AGENTS.md` - API routes reference

## PROJECT STRUCTURE DEVIATIONS
This project has minor deviations from standard patterns (acceptable for current size):
- No Vite proxy configuration (direct API calls to localhost:8000)
- Monolithic App.tsx (862 lines, should split into pages/hooks)
- Duplicate storage directories (use `/backend/storage/uploads/`)
- Backend uses dev mode (`--reload`) in Docker production
- No `/frontend/src/pages/`, `/hooks/`, `/constants/` directories (will need as it grows)
