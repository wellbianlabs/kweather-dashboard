"""관리자 대시보드 — 일 방문 / 트래픽 / 업로드 현황 집계.

관리자 이메일 계정(get_admin)만 접근 가능. 모든 집계는 KST 기준.
"""
from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_admin
from ..models import AccessLog, Device, SensorLog, Tenant
from ..utils import kst_now

router = APIRouter(prefix="/api/admin", tags=["admin"])

DEMO_API_KEY = "demo-key"


@router.get("/overview")
def overview(
    days: int = Query(14, ge=1, le=90),
    _admin: Tenant = Depends(get_admin),
    db: Session = Depends(get_db),
) -> dict:
    now = kst_now()
    today = now.strftime("%Y%m%d")
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # ---- 누적 합계 ----
    members = db.scalar(select(func.count()).select_from(Tenant).where(Tenant.email.isnot(None))) or 0
    devices_total = db.scalar(select(func.count()).select_from(Device)) or 0
    rows_total = db.scalar(select(func.count()).select_from(SensorLog)) or 0

    # ---- 일자별 트래픽/업로드 (요청수·고유방문·업로드건·업로드행) ----
    start_ymd = (today_start - timedelta(days=days - 1)).strftime("%Y%m%d")
    ok_upload = (AccessLog.kind == "upload") & (AccessLog.status < 400)
    agg_rows = db.execute(
        select(
            AccessLog.ymd,
            func.count().label("requests"),
            func.count(func.distinct(AccessLog.visitor)).label("visits"),
            func.sum(case((ok_upload, 1), else_=0)).label("uploads"),
            func.sum(case((AccessLog.kind == "upload", func.coalesce(AccessLog.rows, 0)), else_=0)).label("rows"),
        )
        .where(AccessLog.ymd >= start_ymd)
        .group_by(AccessLog.ymd)
    ).all()
    by_ymd = {r.ymd: r for r in agg_rows}

    # 가입 일자별 버킷(회원 수가 적어 메모리 집계)
    created = db.scalars(select(Tenant.created_at).where(Tenant.created_at.isnot(None))).all()
    signup_by_ymd: dict[str, int] = {}
    for c in created:
        k = c.strftime("%Y%m%d")
        signup_by_ymd[k] = signup_by_ymd.get(k, 0) + 1

    daily = []
    for i in range(days):
        d = today_start - timedelta(days=days - 1 - i)
        k = d.strftime("%Y%m%d")
        r = by_ymd.get(k)
        daily.append({
            "date": d.strftime("%Y-%m-%d"),
            "requests": int(r.requests) if r else 0,
            "visits": int(r.visits) if r else 0,
            "uploads": int(r.uploads) if r and r.uploads else 0,
            "rows": int(r.rows) if r and r.rows else 0,
            "signups": signup_by_ymd.get(k, 0),
        })

    today_row = by_ymd.get(today)
    today_stat = {
        "visits": int(today_row.visits) if today_row else 0,
        "requests": int(today_row.requests) if today_row else 0,
        "uploads": int(today_row.uploads) if today_row and today_row.uploads else 0,
        "rows": int(today_row.rows) if today_row and today_row.rows else 0,
        "signups": db.scalar(
            select(func.count()).select_from(Tenant).where(Tenant.created_at >= today_start)
        ) or 0,
    }

    # ---- 테넌트(회사)별 현황 ----
    dev_counts = dict(
        db.execute(select(Device.tenant_id, func.count()).group_by(Device.tenant_id)).all()
    )
    row_stats = {
        r.tenant_id: r
        for r in db.execute(
            select(
                Device.tenant_id,
                func.count(SensorLog.id).label("rows"),
                func.min(SensorLog.measured_at).label("first"),
                func.max(SensorLog.measured_at).label("last"),
            )
            .join(SensorLog, SensorLog.device_sn == Device.device_sn)
            .group_by(Device.tenant_id)
        ).all()
    }
    last_active = dict(
        db.execute(
            select(AccessLog.tenant_id, func.max(AccessLog.ts))
            .where(AccessLog.tenant_id.isnot(None))
            .group_by(AccessLog.tenant_id)
        ).all()
    )

    tenants = []
    for t in db.scalars(select(Tenant).order_by(Tenant.id)):
        rs = row_stats.get(t.id)
        tenants.append({
            "id": t.id,
            "company": t.name,
            "email": t.email,
            "is_demo": t.api_key == DEMO_API_KEY,
            "devices": int(dev_counts.get(t.id, 0)),
            "rows": int(rs.rows) if rs else 0,
            "first_date": rs.first.strftime("%Y-%m-%d") if rs and rs.first else None,
            "last_date": rs.last.strftime("%Y-%m-%d") if rs and rs.last else None,
            "created_at": t.created_at.strftime("%Y-%m-%d") if t.created_at else None,
            "last_active": last_active[t.id].strftime("%Y-%m-%d %H:%M") if last_active.get(t.id) else None,
        })
    # 데이터 많은 순 정렬
    tenants.sort(key=lambda x: (x["rows"], x["devices"]), reverse=True)

    # ---- 최근 이벤트 ----
    name_by_id = {t["id"]: (t["company"], t["email"]) for t in tenants}
    recent = []
    for a in db.scalars(select(AccessLog).order_by(AccessLog.id.desc()).limit(30)):
        comp, mail = name_by_id.get(a.tenant_id, (None, None))
        recent.append({
            "ts": a.ts.strftime("%m-%d %H:%M:%S") if a.ts else None,
            "company": comp,
            "email": mail,
            "kind": a.kind,
            "method": a.method,
            "path": a.path,
            "status": a.status,
        })

    return {
        "generated_at": now.strftime("%Y-%m-%d %H:%M:%S"),
        "totals": {"members": int(members), "devices": int(devices_total), "rows": int(rows_total)},
        "today": today_stat,
        "daily": daily,
        "tenants": tenants,
        "recent": recent,
    }
