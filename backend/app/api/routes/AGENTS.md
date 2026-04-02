# API ROUTES REFERENCE

**Generated:** 2026-01-29 22:11:49
**Commit:** 63294ec

## OVERVIEW
7 FastAPI REST endpoints using three-layer pattern (Router → Service → MNE-Python).

## ENDPOINTS
| File | Endpoint | Method | Purpose |
|------|----------|--------|---------|
| `health.py` | `/health` | GET | Health check |
| `upload.py` | `/api/upload/` | POST | Upload EDF file |
| `metadata.py` | `/api/metadata/{file_id}` | GET | Get file metadata |
| `waveform.py` | `/api/waveform/{file_id}` | GET | Get waveform data |
| `waveform_overview.py` | `/api/waveform_overview/{file_id}` | GET | Get overview data |
| `signals.py` | `/api/signals/validate` | POST | Validate signal expression |
| `signals.py` | `/api/signals/calculate` | POST | Calculate derived signals |

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| File upload | `upload.py` → `file_manager.py` | 64KB chunked streaming |
| Metadata | `metadata.py` → `edf_parser.py` | Calls get_metadata() |
| Waveform data | `waveform.py` → `edf_parser.py` | Calls load_waveform() |
| Signal validation | `signals.py` → `expression_validator.py` | Syntax/security checks |
| Signal calculation | `signals.py` → `signal_calculator.py` | Expression evaluation |
| Health check | `health.py` | Simple status |
| Overview data | `waveform_overview.py` → `edf_parser.py` | Downsampled data |

## ROUTE PATTERNS
### Standard Pattern
```python
from fastapi import APIRouter, UploadFile
from app.services.edf_parser import EDFParser

router = APIRouter()

@router.post("/api/upload/")
async def upload_file(file: UploadFile):
    parser = EDFParser(file_path)
    metadata = parser.get_metadata()
    return metadata
```

### Service Layer Calls
- **upload.py** → `file_manager.save_uploaded_file()`
- **metadata.py** → `edf_parser.get_metadata()`
- **waveform.py** → `edf_parser.load_waveform()`
- **waveform_overview.py** → `edf_parser.get_overview_data()`
- **signals.py (validate)** → `expression_validator.validate_expression()`
- **signals.py (calculate)** → `signal_calculator.calculate_signals()`

## QUERY PARAMETERS
### Waveform Endpoint
```
GET /api/waveform/{file_id}?start=10&duration=5&channels=0,1,2

start: float      # Start time in seconds
duration: float   # Window duration in seconds
channels: str     # Comma-separated channel indices
```

### Waveform Overview
```
GET /api/waveform_overview/{file_id}?samples_per_second=1.0

samples_per_second: float  # Downsampling rate
```

### Signal Calculation
```
POST /api/signals/calculate
Body: {
  file_id: string,
  start: number,
  duration: number,
  signals: [{
    id: string,
    expression: string,
    operands: Operand[]
  }]
}
```

## SIGNAL API DETAILS
### Expression Validation
```python
POST /api/signals/validate
Body: {
  expression: string,    # e.g., "Fp1 - F3"
  channels: string[]     # Available channel names
}
Response: {
  isValid: boolean,
  referencedChannels: string[],
  error?: string
}
```

### Signal Calculation
```python
POST /api/signals/calculate
Response: [{
  id: string,
  data: number[],        # Computed signal values
  times: number[],       # Time points
  sfreq: number,         # Sampling frequency
  n_samples: number      # Number of samples
}]
```

## ANTI-PATTERNS (ROUTES)
- **NEVER put business logic in routes** → Always delegate to services/
- **NEVER return raw MNE objects** → Convert to dicts/lists
- **NEVER skip validation** → Use Pydantic models for request/response
- **NEVER forget error handling** → Catch EDF parse errors
- **NEVER allow unsafe expressions** → Always validate through expression_validator.py

## TESTING
### Test Files
- `tests/test_health.py` - Health check endpoint
- `tests/test_signals.py` - Signal validation/calculation
- `tests/test_signal_calculator.py` - Signal calculation logic
- `tests/test_api.py` - General API tests

### Test Patterns
- Use `TestClient` from FastAPI
- Mock file uploads with `io.BytesIO`
- Verify status codes and response shapes
- Test error handling (invalid file_id, missing files, invalid expressions)

## GOTCHAS
1. **No models/ directory**: Pydantic models inline in routes (should extract)
2. **No schemas/ directory**: Request/response models not centralized
3. **CORS**: Configured in main.py for localhost:5173 and :3000
4. **File IDs**: UUID-based, stored in file_manager metadata
5. **Expression security**: Validation happens on both frontend and backend
