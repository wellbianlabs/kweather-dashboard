"""주소 -> 위경도 지오코딩.

카카오 로컬 주소검색(키 있으면 우선, 한국 주소 정확)을 쓰고,
실패하거나 키가 없으면 Nominatim(OpenStreetMap, 키 불필요)으로 폴백한다.
"""
from __future__ import annotations

import httpx

from ..config import settings


def _kakao(address: str) -> dict | None:
    key = settings.KAKAO_REST_KEY
    if not key:
        return None
    headers = {"Authorization": f"KakaoAK {key}"}
    with httpx.Client(timeout=10.0, headers=headers) as client:
        # 1) 주소 검색 (도로명/지번)
        r = client.get(
            "https://dapi.kakao.com/v2/local/search/address.json",
            params={"query": address, "size": 1},
        )
        if r.status_code == 200:
            docs = r.json().get("documents", [])
            if docs:
                d = docs[0]
                road = (d.get("road_address") or {}).get("address_name")
                matched = road or d.get("address_name") or address
                # 행정동(h_code)/법정동(b_code) 코드 — 등록 시 저장해 이후 재요청 불필요
                addr = d.get("address") or {}
                rc = addr.get("h_code") or addr.get("b_code") or None
                return {
                    "lat": float(d["y"]), "lon": float(d["x"]),
                    "matched": matched, "provider": "kakao", "region_code": rc,
                }
        # 2) 키워드(장소) 검색 폴백 — 상호/랜드마크
        r2 = client.get(
            "https://dapi.kakao.com/v2/local/search/keyword.json",
            params={"query": address, "size": 1},
        )
        if r2.status_code == 200:
            docs = r2.json().get("documents", [])
            if docs:
                d = docs[0]
                matched = d.get("road_address_name") or d.get("address_name") or d.get("place_name") or address
                return {"lat": float(d["y"]), "lon": float(d["x"]), "matched": matched, "provider": "kakao"}
    return None


def _nominatim(address: str) -> dict | None:
    with httpx.Client(timeout=10.0, headers={"User-Agent": "kweather-dashboard/1.0"}) as client:
        r = client.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": address, "format": "json", "limit": 1, "countrycodes": "kr", "addressdetails": 1},
        )
        if r.status_code == 200:
            arr = r.json()
            if arr:
                d = arr[0]
                return {
                    "lat": float(d["lat"]), "lon": float(d["lon"]),
                    "matched": d.get("display_name") or address, "provider": "nominatim",
                }
    return None


def region_code(lat: float, lon: float) -> str | None:
    """위경도 -> 행정동 코드(10자리). 카카오 coord2regioncode 사용(케이웨더 kw-odam1 호환)."""
    if not settings.KAKAO_REST_KEY or lat is None or lon is None:
        return None
    try:
        with httpx.Client(timeout=10.0, headers={"Authorization": f"KakaoAK {settings.KAKAO_REST_KEY}"}) as client:
            r = client.get(
                "https://dapi.kakao.com/v2/local/geo/coord2regioncode.json",
                params={"x": lon, "y": lat},
            )
            if r.status_code != 200:
                return None
            docs = r.json().get("documents", [])
            h = next((d for d in docs if d.get("region_type") == "H"), None) or (docs[0] if docs else None)
            return h.get("code") if h else None
    except Exception:  # noqa: BLE001
        return None


def geocode(address: str) -> dict | None:
    address = (address or "").strip()
    if not address:
        return None
    for fn in (_kakao, _nominatim):
        try:
            res = fn(address)
            if res:
                res["lat"] = round(res["lat"], 6)
                res["lon"] = round(res["lon"], 6)
                return res
        except Exception:  # noqa: BLE001  (한 제공자 실패 시 다음으로)
            continue
    return None
