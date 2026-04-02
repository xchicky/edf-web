# BACKEND KNOWLEDGE BASE

**Generated:** 2026-01-29 22:11:49
**Commit:** 63294ec

## OVERVIEW
FastAPI 0.104.1 backend with MNE-Python 1.11.0 for EDF parsing, using three-layer architecture.

## STRUCTURE
```
backend/
├── app/
│   ├── main.py              # FastAPI entry (CORS, route registration)
│   ├── config.py            # Configuration management
│   ├── api/
│   │   └── routes/          # 7 REST endpoints (see routes/AGENTS.md)
│   ├── services/            # Business logic layer
│   │   ├── edf_parser.py    # MNE-Python integration (memory optimization)
│   │   ├── signal_calculator.py    # Derived signal calculation
│   │   ├── expression_validator.py # Expression validation
│   │   └── file_manager.py  # File upload/download
│   └── utils/               # Helper utilities
├── tests/                   # Pytest tests (80% coverage)
├── storage/uploads/         # ✅ Authoritative EDF storage
├── requirements.txt         # Pinned dependencies
├── pyproject.toml           # Pytest config
└── Dockerfile               # Python 3.11 slim
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Entry point | `app/main.py` | FastAPI app with CORS |
| EDF parsing | `app/services/edf_parser.py` | Memory-optimized (preload=False) |
| Signal calc | `app/services/signal_calculator.py` | Expression evaluation |
| Expression validation | `app/services/expression_validator.py` | Syntax/security checks |
| File upload | `app/services/file_manager.py` | Chunked 64KB streaming |
| API routes | `app/api/routes/` | 7 endpoints |
| Health check | `app/api/routes/health.py` | GET /health |

## CONVENTIONS
### Backend-Specific
- **Architecture**: Three-layer (Routes → Services → MNE-Python)
- **Testing**: Pytest with 80% coverage gate
- **Async**: asyncio_mode=auto for tests
- **Storage**: `backend/storage/uploads/` (authoritative, ignore `/storage/uploads/`)

### Development
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
pytest --cov=app              # 80% coverage gate
pytest -v                     # Verbose output
```

## CRITICAL MEMORY OPTIMIZATION
### MANDATORY Pattern (edf_parser.py)
```python
# Step 1: Lazy load metadata
raw = mne.io.read_raw_edf(file_path, preload=False, encoding='latin1')

# Step 2: Crop time window
raw.crop(tmin=start_time, tmax=end_time)

# Step 3: Select channels
raw.pick_channels(selected_channels)

# Step 4: Load to memory
raw.load_data()
```
**Result**: 240MB → 2MB (99% reduction)

## DERIVED SIGNAL SYSTEM
### Expression Validation
- **Location**: `app/services/expression_validator.py`
- **Supported**: `+`, `-`, `*`, `/`, `()`, NumPy functions (abs, mean, std, min, max, sum, sqrt, log, exp)
- **Security**: Restricted namespace, no file I/O, 500 char limit
- **Validation**: Syntax check, channel name verification, operator whitelist

### Signal Calculation
- **Location**: `app/services/signal_calculator.py`
- **Pattern**: Load EDF → Validate operands → Load channels → Evaluate expression → Return result
- **Memory**: Only loads required channels/time windows

## ANTI-PATTERNS (BACKEND)
- **NEVER use `preload=True`** → Always use `preload=False` + crop() + load_data()
- **NEVER skip `encoding='latin1'`** → Required for Chinese filenames
- **NEVER use MNE 1.6.0** → Use 1.11.0 (scipy 1.17.0 incompatibility)
- **NEVER load full file into memory** → Always crop() before load_data()
- **NEVER use `/storage/uploads/`** → Use `/backend/storage/uploads/` (authoritative)

## DEPENDENCIES (LOCKED)
```
fastapi==0.104.1
mne==1.11.0              # NOT 1.6.0
uvicorn[standard]==0.24.0
pydantic==2.5.0
pytest==7.4.3
pytest-asyncio==0.21.1
```

## GOTCHAS
1. **Duplicate storage**: `/storage/uploads/` AND `/backend/storage/uploads/` → Use backend version
2. **No models/ directory**: Pydantic models inline in routes (not ideal)
3. **No core/ directory**: config.py at app root (standard: core/config.py)
4. **--reload in Docker**: Production containers use dev mode (intentional for debugging)
5. **Chinese filenames**: Must use `encoding='latin1'` parameter
