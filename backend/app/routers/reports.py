"""리포트 생성/다운로드 API (PRD 3.4)."""
from __future__ import annotations

from datetime import date as date_cls, datetime, time

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_tenant
from ..models import Tenant
from ..schemas import DailyReportData
from ..services import analytics, report

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _now_str() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M")


@router.get("/daily", response_model=DailyReportData)
def daily_data(
    device_sn: str, on_date: date_cls,
    tenant: Tenant = Depends(get_tenant), db: Session = Depends(get_db),
):
    try:
        return analytics.daily_report_data(db, tenant, device_sn, on_date)
    except ValueError as e:
        raise HTTPException(403, str(e))


@router.get("/daily.pdf")
def daily_pdf(
    device_sn: str, on_date: date_cls,
    tenant: Tenant = Depends(get_tenant), db: Session = Depends(get_db),
):
    pdf = report.daily_pdf(db, tenant, device_sn, on_date, _now_str())
    fn = f"daily_{device_sn}_{on_date.isoformat()}.pdf"
    return Response(
        content=pdf, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fn}"'},
    )


@router.get("/periodic.pdf")
def periodic_pdf(
    start: date_cls, end: date_cls, device_sn: str | None = None,
    tenant: Tenant = Depends(get_tenant), db: Session = Depends(get_db),
):
    pdf = report.periodic_pdf(db, tenant, device_sn, start, end, _now_str())
    fn = f"periodic_{start.isoformat()}_{end.isoformat()}.pdf"
    return Response(
        content=pdf, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fn}"'},
    )


@router.get("/export.xlsx")
def export_xlsx(
    start: date_cls, end: date_cls, device_sn: str | None = None,
    tenant: Tenant = Depends(get_tenant), db: Session = Depends(get_db),
):
    xlsx = report.export_excel(
        db, tenant, device_sn,
        datetime.combine(start, time.min), datetime.combine(end, time.max),
    )
    fn = f"export_{start.isoformat()}_{end.isoformat()}.xlsx"
    return Response(
        content=xlsx,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fn}"'},
    )
