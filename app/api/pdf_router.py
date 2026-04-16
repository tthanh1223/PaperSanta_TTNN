"""
pdf_router.py — FastAPI routes cho PDF upload / list / delete / serve
"""

import uuid
import logging
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, Depends, Query
from fastapi.responses import FileResponse, RedirectResponse

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.pdf_service import PDFService
from app.schemas.pdf_schema import (
    UploadResponse,
    PDFListResponse,
    PDFDocumentResponse,
    DeleteResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/pdf", tags=["PDF"])


# POST /api/pdf/upload
@router.post("/upload", response_model=UploadResponse, status_code=201)
async def upload_pdf(
    file: UploadFile = File(..., description="File PDF cần upload"),
    db: AsyncSession = Depends(get_db),
):
    """Upload một file PDF và lưu vào database."""
    doc = await PDFService.upload_pdf(file, db)

    response = UploadResponse(
        id=doc.id,
        filename=doc.filename,
        original_name=doc.original_name,
        file_size=doc.file_size,
        status=doc.status,
        created_at=doc.created_at,
        message="Upload thành công!"
    )

    # Log response để debug
    logger.info(f"Upload response: {response.model_dump()}")

    return response


# GET /api/pdf/
@router.get("/", response_model=PDFListResponse)
async def list_pdfs(
    skip:  int = Query(0,  ge=0,   description="Bỏ qua N records đầu"),
    limit: int = Query(20, ge=1, le=100, description="Số records mỗi trang"),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách tất cả PDF đã upload."""
    total, items = await PDFService.get_all(db, skip=skip, limit=limit)
    return PDFListResponse(total=total, documents=items)


# GET /api/pdf/{doc_id}
@router.get("/{doc_id}", response_model=PDFDocumentResponse)
async def get_pdf(
    doc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Lấy thông tin chi tiết một PDF."""
    doc = await PDFService.get_by_id(doc_id, db)
    return PDFDocumentResponse.model_validate(doc)


# GET /api/pdf/{doc_id}/file  — redirect đến URL của PDF trên Supabase Storage
@router.get("/{doc_id}/file")
async def serve_pdf(
    doc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    redirect: bool = Query(True, description="Redirect to file or return URL"),
):
    """
    Serve PDF từ Supabase Storage.
    - redirect=true (default): Redirect trực tiếp đến PDF để render trên browser
    - redirect=false: Trả về JSON với URL
    """
    url = await PDFService.get_file_url(doc_id, db)

    if redirect:
        # Permanent redirect với cache để tăng tốc
        return RedirectResponse(url=url, status_code=307)
    else:
        return {"url": url}


# DELETE /api/pdf/{doc_id}
@router.delete("/{doc_id}", response_model=DeleteResponse)
async def delete_pdf(
    doc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Xóa một PDF khỏi database và disk."""
    doc = await PDFService.delete(doc_id, db)
    return DeleteResponse(message="Đã xóa thành công.", id=doc.id)
