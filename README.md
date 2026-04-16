# PaperSanta 
Đây là đồ án AI Research Assistant của nhóm Trí Tuệ Nhân Nhượng lớp 24TNT1 cho môn học Tư duy tính toán. 
Hiện tại chỉ implement việc upload pdf chứ chưa có gì thêm
P
## Cấu trúc project
```
papersanta/
├── main.py                    ← FastAPI entry point
├── requirements.txt
├── .env                       ← credentials (đừng commit)
├── uploads/                   ← PDF files lưu ở đây
├── frontend/
│   └── index.html             ← Web UI test
└── app/
    ├── core/
    │   ├── config.py          ← Settings (pydantic-settings)
    │   └── database.py        ← SQLAlchemy engine + session
    ├── models/
    │   └── pdf_document.py    ← ORM model
    ├── schemas/
    │   └── pdf_schema.py      ← Pydantic request/response
    ├── services/
    │   └── pdf_service.py     ← Business logic (dễ test)
    └── api/
        └── pdf_router.py      ← FastAPI routes
```

## Setup

```bash
# 1. Tạo virtual env
python -m venv .venv
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # Mac/Linux

# 2. Cài dependencies
pip install -r requirements.txt

# 3. Điền .env (đã có sẵn, chỉ cần update DB_PASSWORD)

# 4. Chạy server
uvicorn main:app --reload --port 8000
```

## Test

- **Web UI:**     http://localhost:8000
- **Swagger:**    http://localhost:8000/docs
- **Health:**     http://localhost:8000/health

## API Endpoints

| Method | URL | Mô tả |
|--------|-----|-------|
| POST | /api/pdf/upload | Upload PDF |
| GET | /api/pdf/ | Danh sách PDF |
| GET | /api/pdf/{id} | Chi tiết PDF |
| GET | /api/pdf/{id}/file | Serve file (render) |
| DELETE | /api/pdf/{id} | Xóa PDF |

## Phase 2 (RAG)
- Thêm `pgvector` extension vào Supabase
- Thêm `pdf_chunks` table với `embedding vector(1536)`
- Service: extract text → chunk → embed → lưu vector
- API: `POST /api/pdf/{id}/index` và `GET /api/search?q=...`
