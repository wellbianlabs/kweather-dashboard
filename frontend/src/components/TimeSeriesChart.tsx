import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { Kpi, TimeSeries } from "../types";

function fmtTime(t: string) {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const _WD = ["일", "월", "화", "수", "목", "금", "토"];
function fmtDate(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || "");
  if (!m) return d || "";
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일 (${_WD[dt.getDay()]})`;
}

export function TimeSeriesChart({ ts, kpi, date }: { ts: TimeSeries | null; kpi: Kpi | null; date?: string }) {
  const data = (ts?.points || []).map((p) => ({
    time: fmtTime(p.t),
    온도: p.temperature,
    체감온도: p.feels_like,
    습도: p.humidity,
  }));
  const th = kpi?.thresholds;

  return (
    <div className="card">
      {/* 측정 일자 — 언제 데이터인지 한눈에 */}
      {date && (
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-kw-50 px-4 py-2.5">
          <span className="rounded-lg bg-kw px-2.5 py-1 text-[11px] font-bold text-white">측정일</span>
          <span className="text-xl font-extrabold tracking-tight text-kw sm:text-2xl">{fmtDate(date)}</span>
          <span className="ml-auto text-xs text-slate-400">데이터 기준 일자</span>
        </div>
      )}
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">시계열 분석 (온·습도 / 체감온도)</h3>
        <span className="text-xs text-slate-400">
          {ts ? `${ts.interval_minutes}분 평균 다운샘플링` : ""}
        </span>
      </div>
      {data.length === 0 ? (
        <div className="flex h-72 items-center justify-center text-slate-400">데이터가 없습니다.</div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} minTickGap={40} />
            <YAxis yAxisId="temp" tick={{ fontSize: 11 }} unit="℃"
                   domain={["auto", "auto"]} label={{ value: "온도", angle: -90, position: "insideLeft", fontSize: 11 }} />
            <YAxis yAxisId="humi" orientation="right" tick={{ fontSize: 11 }} unit="%"
                   domain={[0, 100]} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area yAxisId="humi" type="monotone" dataKey="습도" fill="#bae6fd" stroke="#38bdf8"
                  fillOpacity={0.35} dot={false} />
            <Line yAxisId="temp" type="monotone" dataKey="온도" stroke="#1790cd" dot={false} strokeWidth={1.5} />
            <Line yAxisId="temp" type="monotone" dataKey="체감온도" stroke="#dc2626" dot={false} strokeWidth={2.2} />
            {th && (
              <>
                <ReferenceLine yAxisId="temp" y={th.caution} stroke="#facc15" strokeDasharray="4 4"
                               label={{ value: "주의 33℃", fontSize: 10, fill: "#a16207", position: "right" }} />
                <ReferenceLine yAxisId="temp" y={th.warning} stroke="#f97316" strokeDasharray="4 4"
                               label={{ value: "경고 35℃", fontSize: 10, fill: "#c2410c", position: "right" }} />
                <ReferenceLine yAxisId="temp" y={th.danger} stroke="#dc2626" strokeDasharray="4 4"
                               label={{ value: "위험 38℃", fontSize: 10, fill: "#b91c1c", position: "right" }} />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
