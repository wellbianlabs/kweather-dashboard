"""주소 -> 위경도 지오코딩 API."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from ..deps import get_tenant
from ..models import Tenant
from ..schemas import GeocodeOut
from ..services import geocode as geocode_svc

router = APIRouter(prefix="/api/geocode", tags=["geocode"])


@router.get("/debug")
def geocode_debug(address: str, tenant: Tenant = Depends(get_tenant)):
    """임시 진단: Vercel -> 카카오 실제 응답(상태/본문) 확인."""
    import httpx

    from ..config import settings

    out = {"key_set": bool(settings.KAKAO_REST_KEY), "addr": address}
    if settings.KAKAO_REST_KEY:
        try:
            r = httpx.get(
                "https://dapi.kakao.com/v2/local/search/address.json",
                params={"query": address, "size": 1},
                headers={"Authorization": f"KakaoAK {settings.KAKAO_REST_KEY}"},
                timeout=10,
            )
            out["kakao_status"] = r.status_code
            out["kakao_body"] = r.text[:400]
        except Exception as e:  # noqa: BLE001
            out["kakao_error"] = repr(e)
    return out


@router.get("", response_model=GeocodeOut)
def geocode(
    address: str = Query(..., min_length=2, description="사업장 주소"),
    tenant: Tenant = Depends(get_tenant),
):
    res = geocode_svc.geocode(address)
    if res is None:
        raise HTTPException(404, "주소를 찾지 못했습니다. 더 구체적으로(시/구/도로명) 입력해 주세요.")
    return res
