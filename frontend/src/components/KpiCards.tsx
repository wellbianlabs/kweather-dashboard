import type { Kpi } from "../types";
import { HeatBadge } from "./HeatBadge";

function Card({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-200">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-bold" style={{ color: accent || "#0f172a" }}>{value}</span>
        {unit && <span className="text-sm text-slate-400">{unit}</span>}
      </div>
    </div>
  );
}

export function KpiCards({ kpi }: { kpi: Kpi | null }) {
  const v = (n: number | null | undefined, d = 1) => (n == null ? "-" : n.toFixed(d));
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <div className="rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col justify-between"
           style={{ background: kpi ? `${kpi.current_level.color}14` : "#fff" }}>
        <div className="text-xs font-medium text-slate-500">폭염 위험 단계 (기간 최고)</div>
        <div className="mt-2">{kpi ? <HeatBadge level={kpi.current_level} size="lg" /> : "-"}</div>
      </div>
      <Card label="최고 체감온도 (A-TEMP)" value={v(kpi?.max_feels_like)} unit="℃"
            accent={kpi?.current_level.color} />
      <Card label="최고 온도 (TEMP)" value={v(kpi?.max_temperature)} unit="℃" />
      <Card label="평균 체감온도" value={v(kpi?.avg_feels_like)} unit="℃" />
      <Card label="평균 습도" value={v(kpi?.avg_humidity)} unit="%" />
    </div>
  );
}
