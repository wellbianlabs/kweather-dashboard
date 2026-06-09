"""주소 -> 위경도 지오코딩 API."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from ..deps import get_tenant
from ..models import Tenant
from ..schemas import GeocodeOut
from ..services import geocode as geocode_svc

router = APIRouter(prefix="/api/geocode", tags=["geocode"])


@router.get("", response_model=GeocodeOut)
def geocode(
    address: str = Query(..., min_length=2, description="사업장 주소"),
    tenant: Tenant = Depends(get_tenant),
):
    res = geocode_svc.geocode(address)
    if res is None:
        raise HTTPException(404, "주소를 찾지 못했습니다. 더 구체적으로(시/구/도로명) 입력해 주세요.")
    return res
