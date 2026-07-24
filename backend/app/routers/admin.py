"""관리자 대시보드 — 일 방문 / 트래픽 / 업로드 현황 집계.

관리자 이메일 계정(get_admin)만 접근 가능. 모든 집계는 KST 기준.
"""
from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from pydantic import BaseModel

from ..database import get_db
from ..deps import get_admin
from ..models import AccessLog, AppSetting, Device, ExternalDailyCache, SensorLog, Tenant
from ..services import appsettings
from ..utils import kst_now

router = APIRouter(prefix="/api/admin", tags=["admin"])

DEMO_API_KEY = "demo-key"


@router.get("/settings")
def get_settings(_admin: Tenant = Depends(get_admin), db: Session = Depends(get_db)) -> dict:
    """외부 연동 키 등 런타임 설정 현황(비밀키는 마스킹)."""
    return {"keys": appsettings.MANAGED_KEYS, "status": appsettings.masked_status(db)}


class SettingsUpdate(BaseModel):
    updates: dict[str, str]   # {name: value} — 빈 문자열은 해당 키 삭제(.env 폴백)


@router.put("/settings")
def put_settings(
    payload: SettingsUpdate, _admin: Tenant = Depends(get_admin), db: Session = Depends(get_db)
) -> dict:
    appsettings.save(db, payload.updates)
    return {"ok": True, "status": appsettings.masked_status(db)}


@router.get("/system")
def system(_admin: Tenant = Depends(get_admin), db: Session = Depends(get_db)) -> dict:
    """서버 상태·용량 + 유지보수 현황(DB/디스크/메모리/기상청 호출/백업/로그)."""
    import glob
    import os
    import shutil
    import time as _time

    from sqlalchemy import text

    out: dict = {"generated_at": kst_now().strftime("%Y-%m-%d %H:%M:%S")}
    dialect = db.get_bind().dialect.name

    # ---- DB ----
    dbinfo: dict = {"engine": dialect, "engine_label": dialect}
    try:
        if dialect == "postgresql":
            ver = db.execute(text("show server_version")).scalar()
            dbinfo["engine_label"] = f"PostgreSQL {ver}"
            dbinfo["size_bytes"] = int(db.execute(text("select pg_database_size(current_database())")).scalar())
            dbinfo["max_connections"] = int(db.execute(text("show max_connections")).scalar())
            dbinfo["connections"] = int(db.execute(text("select count(*) from pg_stat_activity")).scalar())
            rows = db.execute(text(
                "select relname, pg_total_relation_size(c.oid) b "
                "from pg_class c join pg_namespace n on n.oid=c.relnamespace "
                "where n.nspname='public' and c.relkind='r' order by b desc limit 12")).all()
            dbinfo["tables"] = [{"name": r[0], "bytes": int(r[1])} for r in rows]
    except Exception as e:  # noqa: BLE001
        dbinfo["error"] = str(e)[:120]

    counts: dict = {}
    for name, model in (("sensor_logs", SensorLog), ("access_logs", AccessLog),
                        ("external_daily_cache", ExternalDailyCache), ("tenants", Tenant),
                        ("devices", Device), ("app_settings", AppSetting)):
        try:
            counts[name] = int(db.scalar(select(func.count()).select_from(model)) or 0)
        except Exception:  # noqa: BLE001
            counts[name] = None
    dbinfo["row_counts"] = counts

    # ---- 서버 자원(디스크/메모리/부하) ----
    server: dict = {}
    try:
        du = shutil.disk_usage("/")
        server["disk"] = {"total": du.total, "used": du.used, "free": du.free,
                          "pct": round(du.used / du.total * 100, 1)}
    except Exception:  # noqa: BLE001
        pass
    try:
        mi: dict = {}
        with open("/proc/meminfo") as f:
            for ln in f:
                k, _, v = ln.partition(":")
                mi[k.strip()] = int(v.strip().split()[0]) * 1024  # kB -> bytes
        total, avail = mi.get("MemTotal", 0), mi.get("MemAvailable", 0)
        server["memory"] = {"total": total, "available": avail, "used": total - avail,
                            "pct": round((total - avail) / total * 100, 1) if total else None}
    except Exception:  # noqa: BLE001
        pass
    try:
        server["load"] = [round(x, 2) for x in os.getloadavg()]
        server["cpu_count"] = os.cpu_count()
    except Exception:  # noqa: BLE001
        pass
    try:
        with open("/proc/uptime") as f:
            server["uptime_sec"] = int(float(f.read().split()[0]))
    except Exception:  # noqa: BLE001
        pass

    # ---- 외부(기상청) 연동 호출 현황 ----
    today = kst_now().strftime("%Y%m%d")
    ext: dict = {"provider": appsettings.get("WEATHER_PROVIDER"),
                 "cached_days": counts.get("external_daily_cache"),
                 "daily_quota": 1000000}  # data.go.kr ASOS 시간자료(현 계정 일일 트래픽)
    try:
        ext["api_requests_total"] = int(db.scalar(
            select(func.count()).select_from(AccessLog).where(AccessLog.path.like("/api/weather%"))) or 0)
        ext["api_requests_today"] = int(db.scalar(
            select(func.count()).select_from(AccessLog).where(
                AccessLog.path.like("/api/weather%"), AccessLog.ymd == today)) or 0)
    except Exception:  # noqa: BLE001
        pass

    # ---- 접근 로그(보존정책) ----
    logs: dict = {"access_rows": counts.get("access_logs"), "retention_days": 90}
    try:
        oldest = db.scalar(select(func.min(AccessLog.ts)))
        logs["oldest"] = oldest.strftime("%Y-%m-%d %H:%M") if oldest else None
    except Exception:  # noqa: BLE001
        pass

    # ---- 백업 현황 ----
    bk: dict = {"dir": "/opt/kweather/backups"}
    try:
        files = sorted(glob.glob("/opt/kweather/backups/kweather_*.dump"),
                       key=os.path.getmtime, reverse=True)
        bk["count"] = len(files)
        bk["total_bytes"] = sum(os.path.getsize(f) for f in files)
        if files:
            bk["latest"] = os.path.basename(files[0])
            bk["latest_bytes"] = os.path.getsize(files[0])
            bk["latest_at"] = _time.strftime("%Y-%m-%d %H:%M", _time.localtime(os.path.getmtime(files[0])))
    except Exception as e:  # noqa: BLE001
        bk["error"] = str(e)[:120]

    out["db"] = dbinfo
    out["server"] = server
    out["external"] = ext
    out["logs"] = logs
    out["backup"] = bk
    return out


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


@router.get("/logs")
def access_logs(
    page: int = Query(1, ge=1),
    per: int = Query(20, ge=1, le=100),
    days: int = Query(30, ge=1, le=90),
    _admin: Tenant = Depends(get_admin),
    db: Session = Depends(get_db),
) -> dict:
    """접근 로그 전체 조회 — 최근 N일(기본 30일)분을 서버측 페이지네이션(기본 20개)으로.

    overview.recent(최근 30건 고정)와 달리 기간 내 로그 전부를 페이지로 넘겨볼 수 있다.
    """
    now = kst_now()
    start_ymd = (now - timedelta(days=days - 1)).strftime("%Y%m%d")
    cond = AccessLog.ymd >= start_ymd
    total = int(db.scalar(select(func.count()).select_from(AccessLog).where(cond)) or 0)

    tmap = {t.id: (t.name, t.email) for t in db.scalars(select(Tenant))}
    items = []
    for a in db.scalars(
        select(AccessLog).where(cond).order_by(AccessLog.id.desc())
        .offset((page - 1) * per).limit(per)
    ):
        comp, mail = tmap.get(a.tenant_id, (None, None))
        items.append({
            "ts": a.ts.strftime("%m-%d %H:%M:%S") if a.ts else None,
            "company": comp,
            "email": mail,
            "kind": a.kind,
            "method": a.method,
            "path": a.path,
            "status": a.status,
        })
    return {"total": total, "page": page, "per": per, "days": days, "items": items}
