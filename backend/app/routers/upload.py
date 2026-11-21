"""측정 데이터 업로드 (PRD 3.1) — TXT/CSV 자동 감지, 다중 파일 지원."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import block_demo, get_tenant
from ..models import Tenant
from ..schemas import UploadResult
from ..services import ingest

router = APIRouter(prefix="/api/upload", tags=["upload"])


@router.post("", response_model=list[UploadResult])
async def upload_csv(
    request: Request,
    files: list[UploadFile] = File(...),
    device_sn: str | None = Form(None),  # TXT(파일 내 SN 없음) 연결용 기기 SN
    tenant: Tenant = Depends(get_tenant),
    db: Session = Depends(get_db),
):
    block_demo(tenant)
    results: list[UploadResult] = []
    for f in files:
        raw = await f.read()
        results.append(
            ingest.ingest_csv(db, tenant, f.filename or "upload.csv", raw, device_sn=device_sn)
        )
    # 접근 로그에 반영 행수 기록(관리자 업로드 현황 집계용)
    request.state.upload_rows = sum(r.rows_inserted + r.rows_updated for r in results)
    return results
