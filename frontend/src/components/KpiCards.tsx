import type { Kpi } from "../types";
import { HeatBadge } from "./HeatBadge";

function Card({ label, value, unit, accent, sub }:
  { label: string; value: string; unit?: string; accent?: string; sub?: string }) {
  return (
    <div className="card !p-4">
      <div className="text-xs font-medium tracking-tight text-slate-400">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-[26px] font-bold tracking-tight" style={{ color: accent || "#0f172a" }}>{value}</span>
        {unit && <span className="text-sm text-slate-400">{unit}</span>}
      </div>
      <div className="mt-1 h-4 text-xs text-slate-400">{sub || ""}</div>
    </div>
  );
}

// 분 -> "Xh Ym" / "Y분" 보기 좋게
function fmtDuration(min: number | null | undefined): string {
  if (!min || min <= 0) return "0분";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

export function KpiCards({ kpi }: { kpi: Kpi | null }) {
  const v = (n: number | null | undefined, d = 1) => (n == null ? "-" : n.toFixed(d));
  const danger = kpi?.danger_minutes ?? 0;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="flex flex-col justify-between rounded-2xl border border-slate-200/70 p-4 shadow-card"
           style={{ background: kpi ? `linear-gradient(135deg, #ffffff 30%, ${kpi.current_level.color}1a)` : "#fff" }}>
        <div className="text-xs font-medium tracking-tight text-slate-400">폭염 위험 단계 (기간 최고)</div>
        <div className="mt-2">{kpi ? <HeatBadge level={kpi.current_level} size="lg" /> : "-"}</div>
      </div>
      <Card label="최고 체감온도 (A-TEMP)" value={v(kpi?.max_feels_like)} unit="℃"
            accent={kpi?.current_level.color}
            sub={kpi?.max_feels_like_time ? `${kpi.max_feels_like_time} 발생` : ""} />
      <Card label="최고 온도 (TEMP)" value={v(kpi?.max_temperature)} unit="℃"
            sub={kpi?.max_temperature_time ? `${kpi.max_temperature_time} 발생` : ""} />
      <Card label="위험단계 이상 지속 (체감 38℃↑)" value={fmtDuration(danger)}
            accent={danger > 0 ? "#dc2626" : undefined}
            sub={danger > 0 ? "온열질환 고위험 누적" : "위험단계 미발생"} />
    </div>
  );
}
