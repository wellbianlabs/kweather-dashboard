"""CSV 업로드 (PRD 3.1) — 다중 파일 지원."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_tenant
from ..models import Tenant
from ..schemas import UploadResult
from ..services import ingest

router = APIRouter(prefix="/api/upload", tags=["upload"])


@router.post("", response_model=list[UploadResult])
async def upload_csv(
    files: list[UploadFile] = File(...),
    tenant: Tenant = Depends(get_tenant),
    db: Session = Depends(get_db),
):
    results: list[UploadResult] = []
    for f in files:
        raw = await f.read()
        results.append(ingest.ingest_csv(db, tenant, f.filename or "upload.csv", raw))
    return results
