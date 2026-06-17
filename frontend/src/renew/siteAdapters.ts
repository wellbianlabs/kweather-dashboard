// SiteRisk(컨텍스트) → DataTable 행 / 위험지도 RiskSite 변환 (대시보드·지도 페이지 공용).
import type { SiteRisk } from "./DashboardProvider";
import type { SiteRow } from "../components/ui/DataTable";
import type { RiskSite } from "../components/RiskMapSkeleton";
import type { HeatLevel } from "../types";

const NO_LEVEL: HeatLevel = { code: "none", label: "데이터 없음", color: "#94a3b8", rank: 0 };

export function toSiteRows(sites: SiteRisk[]): SiteRow[] {
  return sites.map((s) => ({
    sn: s.device_sn,
    company: s.company_name ?? "-",
    location: s.location_name ?? s.address ?? "-",
    feels: s.feels != null ? `${s.feels}℃` : "-",
    level: s.level?.label ?? "-",
    levelColor: s.level?.color,
  }));
}

export function toRiskSites(sites: SiteRisk[]): RiskSite[] {
  return sites.map((s) => ({
    sn: s.device_sn,
    name: [s.company_name, s.location_name].filter(Boolean).join(" · ") || s.device_sn,
    lat: s.latitude,
    lon: s.longitude,
    feels: s.feels ?? 0,
    level: s.level ?? NO_LEVEL,
  }));
}
