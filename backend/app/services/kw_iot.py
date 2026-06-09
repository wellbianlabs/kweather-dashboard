"""케이웨더 IoT 플랫폼 연동 — 단말기 실시간 측정값(last-all) 동기화.

Vercel 환경변수(KW_IOT_BASE_URL/KW_IOT_API_KEY/KW_IOT_USER_ID)로 설정.
가져온 실측값을 sensor_logs 로 적재하여 대시보드/리포트에 즉시 반영한다.
체감온도(A-TEMP)는 응답의 senseTemp 가 있으면 사용, 없으면 온도·습도로 체감온도(겉보기온도)를 산출.
"""
from __future__ import annotations

import math
from datetime import datetime

import httpx
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Device, Tenant
from . import ingest


def _apparent_temp(t: float | None, rh: float | None) -> float | None:
    """겉보기온도(Steadman/호주 BoM, 무풍 가정) — senseTemp 미제공 시 체감온도 대체."""
    if t is None or rh is None:
        return t
    try:
        e = (float(rh) / 100.0) * 6.105 * math.exp(17.27 * float(t) / (237.7 + float(t)))
        return round(float(t) + 0.33 * e - 4.00, 1)
    except Exception:  # noqa: BLE001
        return float(t) if t is not None else None


def fetch_last_all() -> list[dict]:
    if not settings.KW_IOT_API_KEY or not settings.KW_IOT_USER_ID:
        raise RuntimeError("KW_IOT_API_KEY / KW_IOT_USER_ID 미설정")
    url = f"{settings.KW_IOT_BASE_URL}/last-all"
    params = {
        "stationType": "ALL",
        "idType": "USER",
        "id": settings.KW_IOT_USER_ID,
        "api_key": settings.KW_IOT_API_KEY,
    }
    with httpx.Client(timeout=15.0) as client:
        r = client.get(url, params=params)
        r.raise_for_status()
        j = r.json()
    if str(j.get("error")) != "0":
        raise RuntimeError(j.get("message") or "KW IoT error")
    result = j.get("result", {}) or {}
    out: list[dict] = []
    for kind, key in (("indoor", "iaqList"), ("outdoor", "oaqList")):
        for it in result.get(key, []) or []:
            sn = it.get("serialNo") or it.get("stationName")
            if not sn:
                continue
            temp = it.get("temp")
            humi = it.get("humi")
            feels = it.get("senseTemp")
            if feels is None:
                feels = _apparent_temp(temp, humi)
            ts = str(it.get("date") or "")
            try:
                mt = datetime.strptime(ts[:12], "%Y%m%d%H%M")
            except Exception:  # noqa: BLE001
                mt = None
            out.append({
                "sn": sn, "name": it.get("stationName"), "kind": kind, "measured_at": mt,
                "temperature": temp, "humidity": humi, "feels_like": feels,
                "co2": it.get("co2"), "pm10": it.get("pm10"), "pm25": it.get("pm25"), "voc": it.get("voc"),
            })
    return out


def sync(db: Session, tenant: Tenant) -> dict:
    readings = fetch_last_all()
    valid = [
        r for r in readings
        if r["measured_at"] is not None and r["temperature"] is not None and r["feels_like"] is not None
    ]
    if not valid:
        return {"fetched": len(readings), "ingested": 0, "devices": [], "new_devices": [],
                "errors": ["수신된 유효 측정값이 없습니다."], "readings": []}

    # 단말기(시리얼) 등록 + 테넌트 격리 가드
    sns = sorted({r["sn"] for r in valid})
    existing = {d.device_sn: d for d in db.scalars(select(Device).where(Device.device_sn.in_(sns)))}
    new_devices: list[str] = []
    blocked: set[str] = set()
    errors: list[str] = []
    for sn in sns:
        dev = existing.get(sn)
        if dev is None:
            db.add(Device(device_sn=sn, tenant_id=tenant.id, company_name=tenant.name))
            new_devices.append(sn)
        elif dev.tenant_id != tenant.id:
            blocked.add(sn)
            errors.append(f"{sn}: 다른 계정 소유 단말기")
    db.flush()

    rows = [r for r in valid if r["sn"] not in blocked]
    df = pd.DataFrame([
        {
            "measured_at": pd.Timestamp(r["measured_at"]), "sn": r["sn"],
            "temperature": float(r["temperature"]),
            "humidity": r["humidity"], "feels_like": float(r["feels_like"]),
        }
        for r in rows
    ])
    inserted, updated = ingest._upsert_logs(db, df) if not df.empty else (0, 0)
    db.commit()

    return {
        "fetched": len(readings), "ingested": inserted + updated,
        "inserted": inserted, "updated": updated,
        "devices": sns, "new_devices": new_devices, "errors": errors,
        "readings": [
            {
                "sn": r["sn"], "kind": r["kind"],
                "temp": r["temperature"], "humi": r["humidity"], "feels": r["feels_like"],
                "co2": r.get("co2"), "pm10": r.get("pm10"), "pm25": r.get("pm25"),
                "at": r["measured_at"].strftime("%Y-%m-%d %H:%M") if r["measured_at"] else None,
            }
            for r in valid
        ],
    }
