"""대시보드 데이터 API (PRD 3.2)."""
from __future__ import annotations

from datetime import date as date_cls, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_tenant
from ..models import Tenant
from ..schemas import KpiSummary, MapMarker, TimeSeriesOut
from ..services import analytics

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/kpi", response_model=KpiSummary)
def kpi(
    device_sn: str | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    tenant: Tenant = Depends(get_tenant),
    db: Session = Depends(get_db),
):
    return analytics.kpi_summary(db, tenant, device_sn, start, end)


@router.get("/timeseries", response_model=TimeSeriesOut)
def timeseries(
    device_sn: str,
    start: datetime | None = None,
    end: datetime | None = None,
    interval: int = Query(10, ge=1, le=120, description="다운샘플링 분 단위(10/30 권장)"),
    tenant: Tenant = Depends(get_tenant),
    db: Session = Depends(get_db),
):
    return analytics.time_series(db, tenant, device_sn, start, end, interval)


@router.get("/map", response_model=list[MapMarker])
def map_view(
    on_date: date_cls | None = Query(None, description="해당 일자 최고 체감온도 기준"),
    tenant: Tenant = Depends(get_tenant),
    db: Session = Depends(get_db),
):
    return analytics.map_markers(db, tenant, on_date)
