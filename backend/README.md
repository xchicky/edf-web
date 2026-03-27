# EDF Web Backend

FastAPI 后端服务，提供 EDF 文件解析和数据分析功能。

## 技术栈

- FastAPI 0.104.1
- MNE-Python 1.11.0
- Python 3.11

## 启动方式

```bash
# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 启动服务
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## API 文档

启动服务后访问 http://localhost:8000/docs

修改日期：2026年3月27日
