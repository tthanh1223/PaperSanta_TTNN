"""
paper_search_service.py — Search papers via Semantic Scholar API
"""
import logging, asyncio, httpx
from typing import List, Dict, Optional
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.models.pdf_document import PDFDocument
from app.core.config import settings
from deep_translator import GoogleTranslator

logger = logging.getLogger(__name__)
_search_cache: Dict[str, Dict[str, any]] = {}

class PaperSearchService:
    """Tìm kiếm papers từ ngoại sàn (Semantic Scholar)"""
    CACHE_TTL_MINUTES = 60
    S2_BASE_URL = "https://api.semanticscholar.org/graph/v1"

    @staticmethod
    def _check_cache(cache_key: str) -> Optional[Dict]:
        """Check cache nội bộ (TTL 1 giờ)"""
        cached = _search_cache.get(cache_key)
        if cached and (datetime.now(timezone.utc) - cached["created_at"] < timedelta(minutes=PaperSearchService.CACHE_TTL_MINUTES)):
            return cached["data"]
        return None

    @staticmethod
    async def search_papers(query: str, limit: int = 10, offset: int = 0, year_from: Optional[int] = None, year_to: Optional[int] = None, min_citations: Optional[int] = None) -> Dict[str, any]:
        try:
            trans = GoogleTranslator(source='auto', target='en').translate(query)
            if trans and trans != query: query = trans
        except Exception as e: logger.warning(f"Translation failed: {e}")
        
        cache_key = f"{query}|{limit}|{offset}|{year_from}|{year_to}"
        cached = PaperSearchService._check_cache(cache_key)
        if cached: return cached

        try:
            params = {"query": query, "limit": limit, "offset": offset, "fields": "title,abstract,year,authors,venue,citationCount,openAccessPdf"}
            if year_from or year_to: params["year"] = f"{year_from or ''}-{year_to or ''}".strip("-")

            async with httpx.AsyncClient(timeout=10) as client:
                res = await client.get(f"{PaperSearchService.S2_BASE_URL}/paper/search", params=params, headers={"x-api-key": settings.SEMANTIC_SCHOLAR_API_KEY})
                res.raise_for_status()
                data = res.json()

            papers = []
            for p in data.get("data", []):
                cit = p.get("citationCount", 0)
                if min_citations and cit < min_citations: continue
                pdf = p.get("openAccessPdf", {}).get("url") if isinstance(p.get("openAccessPdf"), dict) else None
                papers.append({
                    "s2_id": p.get("paperId", ""), "title": p.get("title", ""), "abstract": p.get("abstract"), "year": p.get("year"),
                    "authors": [a.get("name", "") for a in p.get("authors", [])], "venue": p.get("venue") or "Nguồn học thuật",
                    "citation_count": cit, "open_access_pdf": pdf or f"https://www.semanticscholar.org/paper/{p.get('paperId', '')}"
                })
            result = {"total": data.get("total", 0), "query": query, "papers": papers}
            _search_cache[cache_key] = {"data": result, "created_at": datetime.now(timezone.utc)}
            return result
        except Exception as e:
            logger.error(f"S2 search error: {e}")
            return {"total": 0, "query": query, "papers": []}

    @staticmethod
    async def get_paper_detail(s2_id: str) -> Dict[str, any]:
        cache_key = f"detail|{s2_id}"
        cached = PaperSearchService._check_cache(cache_key)
        if cached: return cached
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                res = await client.get(f"{PaperSearchService.S2_BASE_URL}/paper/{s2_id}", params={"fields": "title,abstract,year,authors,venue,citationCount,referenceCount,openAccessPdf"}, headers={"x-api-key": settings.SEMANTIC_SCHOLAR_API_KEY})
                res.raise_for_status()
                p = res.json()

            if not p: return {}
            pdf = p.get("openAccessPdf", {}).get("url") if isinstance(p.get("openAccessPdf"), dict) else None
            result = {
                "s2_id": s2_id, "title": p.get("title", ""), "abstract": p.get("abstract"), "year": p.get("year"),
                "authors": [a.get("name", "") for a in p.get("authors", [])], "venue": p.get("venue") or "Nguồn học thuật",
                "citation_count": p.get("citationCount", 0), "reference_count": p.get("referenceCount", 0), "open_access_pdf": pdf or f"https://www.semanticscholar.org/paper/{s2_id}"
            }
            _search_cache[cache_key] = {"data": result, "created_at": datetime.now(timezone.utc)}
            return result
        except Exception as e:
            logger.error(f"S2 detail error: {e}")
            return {}

    @staticmethod
    async def search_related_papers(pdf_id: str, user_id: str, db: AsyncSession) -> Dict[str, any]:
        try:
            paper = (await db.execute(select(PDFDocument).where(and_(PDFDocument.id == pdf_id, PDFDocument.user_id == user_id)))).scalar_one_or_none()
            if not paper: return {"error": "Không tìm thấy tài liệu yêu cầu", "status_code": 404}

            # KIỂM TRA & XỬ LÝ NHÁNH TÌM KIẾM (Đề phòng extracted_topics chưa được mở comment ở Model, thak nào cốt phần này làm lẹ coi)
            if hasattr(paper, "extracted_topics") and paper.extracted_topics is not None and isinstance(paper.extracted_topics, list):
                topics, method = paper.extracted_topics, "precomputed"
            else:
                fn = paper.original_name[:-4] if paper.original_name.lower().endswith(".pdf") else paper.original_name
                for c in ["_", "-", ".", "@", "+"]: fn = fn.replace(c, " ")
                topics, method = [" ".join(fn.split())], "title_fallback"

            results = await asyncio.gather(*[PaperSearchService.search_papers(query=t, limit=10) for t in topics])
            all_papers = {p["s2_id"]: p for res in results for p in res.get("papers", []) if p.get("open_access_pdf")}
            
            return {
                "source_pdf_id": str(pdf_id), "extracted_topics": topics, "method": method,
                "related_papers": sorted(all_papers.values(), key=lambda p: p["citation_count"], reverse=True)[:10]
            }
        except Exception as e:
            logger.error(f"Related papers error: {e}")
            return {"error": f"Lỗi hệ thống: {str(e)}", "status_code": 500}