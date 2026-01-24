# Docker Quick Start Guide

## One-Command Startup

```bash
docker-compose up -d
```

This will start:
- Backend API: http://localhost:8000
- Frontend App: http://localhost:5173
- API Docs: http://localhost:8000/docs

## Manual Development Setup

If you prefer to run services manually (for hot-reload debugging):

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Docker Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Rebuild after code changes
docker-compose up -d --build

# Clean up everything
docker-compose down -v
```

## Troubleshooting

### Port Already in Use
```bash
# Check what's using the port
lsof -i :8000  # Backend
lsof -i :5173  # Frontend

# Kill the process
kill -9 <PID>
```

### Permission Issues
```bash
# Fix storage permissions
sudo chmod -R 755 backend/storage
```

### Backend Dependencies Issues
```bash
# Rebuild backend container
docker-compose build backend
docker-compose up -d backend
```

## Health Check

```bash
# Check backend health
curl http://localhost:8000/health

# Expected response: {"status": "healthy"}
```
