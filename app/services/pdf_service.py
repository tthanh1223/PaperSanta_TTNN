"""
pdf_service.py — Business logic: lưu file, ghi DB, query
Tách khỏi route để dễ unit test
"""

import os
import uuid
import shutil
import logging
from pathlib import Path
from io import BytesIO

from fastapi import UploadFile, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from supabase import create_client, Client
from pypdf import PdfReader, PdfWriter

from app.core.config import settings
from app.models.pdf_document import PDFDocument, ProcessingStatus

logger = logging.getLogger(__name__)

# ── Supabase Storage Client ──────────────────────────────────────────────────
def get_supabase_client() -> Client:
    """Tạo Supabase client cho Storage operations"""
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        raise HTTPException(500, "Supabase credentials chưa được cấu hình")
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


# ── PDF Compression ───────────────────────────────────────────────────────────
def compress_pdf(content: bytes) -> bytes:
    """Nén PDF để giảm dung lượng trước khi upload"""
    try:
        reader = PdfReader(BytesIO(content))
        writer = PdfWriter()

        # Copy tất cả pages và compress
        for page in reader.pages:
            writer.add_page(page)

        # Compress tất cả content streams
        for page in writer.pages:
            page.compress_content_streams()

        # Remove metadata để giảm size
        writer.add_metadata({"/Producer": "PaperSanta PDF Service"})

        # Write to bytes
        output = BytesIO()
        writer.write(output)
        compressed = output.getvalue()

        original_size = len(content)
        compressed_size = len(compressed)
        compression_ratio = (1 - compressed_size / original_size) * 100

        logger.info(f"PDF compressed: {original_size} → {compressed_size} bytes ({compression_ratio:.1f}% reduction)")

        return compressed

    except Exception as e:
        logger.warning(f"PDF compression failed: {e}, using original file")
        return content  # Fallback to original nếu nén lỗi


class PDFService:

    # ── Upload & Save ─────────────────────────────────────────────────────────
    @staticmethod
    async def upload_pdf(
        file: UploadFile,
        db: AsyncSession,
    ) -> PDFDocument:
        """
        1. Validate file
        2. Upload lên Supabase Storage
        3. Tạo record trong DB với public URL
        """
        # Validate extension
        ext = Path(file.filename).suffix.lower().lstrip(".")
        if ext not in settings.ALLOWED_EXTENSIONS:
            raise HTTPException(400, f"Chỉ chấp nhận file PDF, nhận được: .{ext}")

        # Validate size
        content = await file.read()
        if len(content) > settings.max_file_size_bytes:
            raise HTTPException(
                413,
                f"File quá lớn. Tối đa {settings.MAX_FILE_SIZE_MB}MB."
            )

        # Nén PDF trước khi upload
        compressed_content = compress_pdf(content)

        # Tạo tên file unique
        unique_filename = f"{uuid.uuid4().hex}.pdf"

        # Upload lên Supabase Storage
        try:
            supabase = get_supabase_client()
            response = supabase.storage.from_(settings.SUPABASE_STORAGE_BUCKET).upload(
                path=unique_filename,
                file=compressed_content,
                file_options={"content-type": "application/pdf"}
            )

            # Lấy public URL
            public_url = supabase.storage.from_(settings.SUPABASE_STORAGE_BUCKET).get_public_url(unique_filename)

            logger.info(f"Uploaded to Supabase Storage: {unique_filename} ({len(compressed_content)} bytes)")

        except Exception as e:
            logger.error(f"Failed to upload to Supabase Storage: {e}")
            raise HTTPException(500, f"Lỗi khi upload file: {str(e)}")

        # Ghi vào DB với public URL
        doc = PDFDocument(
            filename=unique_filename,
            original_name=file.filename,
            file_size=len(content),
            file_path=public_url,  # Lưu public URL thay vì local path
            mime_type=file.content_type or "application/pdf",
            status=ProcessingStatus.PENDING,
        )
        db.add(doc)
        await db.flush()
        await db.refresh(doc)

        logger.info(f"Created PDF record: {doc.id}")
        return doc

    # ── Queries ───────────────────────────────────────────────────────────────
    @staticmethod
    async def get_all(
        db: AsyncSession,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[int, list[PDFDocument]]:
        """Lấy danh sách PDF với pagination"""
        total_q = await db.execute(select(func.count()).select_from(PDFDocument))
        total = total_q.scalar_one()

        result = await db.execute(
            select(PDFDocument)
            .order_by(PDFDocument.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        items = result.scalars().all()
        return total, list(items)

    @staticmethod
    async def get_by_id(doc_id: uuid.UUID, db: AsyncSession) -> PDFDocument:
        result = await db.execute(
            select(PDFDocument).where(PDFDocument.id == doc_id)
        )
        doc = result.scalar_one_or_none()
        if not doc:
            raise HTTPException(404, f"Không tìm thấy PDF: {doc_id}")
        return doc

    # ── Delete ────────────────────────────────────────────────────────────────
    @staticmethod
    async def delete(doc_id: uuid.UUID, db: AsyncSession) -> PDFDocument:
        doc = await PDFService.get_by_id(doc_id, db)

        # Xóa file trên Supabase Storage
        try:
            supabase = get_supabase_client()
            supabase.storage.from_(settings.SUPABASE_STORAGE_BUCKET).remove([doc.filename])
            logger.info(f"Deleted from Supabase Storage: {doc.filename}")
        except Exception as e:
            logger.warning(f"Could not delete file from Supabase Storage: {e}")

        # Xóa record
        await db.delete(doc)
        await db.flush()

        return doc

    # ── Get file URL (để serve file) ──────────────────────────────────────────
    @staticmethod
    async def get_file_url(doc_id: uuid.UUID, db: AsyncSession) -> str:
        """Lấy public URL của PDF từ Supabase Storage"""
        doc = await PDFService.get_by_id(doc_id, db)
        return doc.file_path  # file_path giờ chứa public URL
