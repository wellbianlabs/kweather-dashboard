import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { Kpi, TimeSeries } from "../types";

function fmtTime(t: string) {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function TimeSeriesChart({ ts, kpi }: { ts: TimeSeries | null; kpi: Kpi | null }) {
  const data = (ts?.points || []).map((p) => ({
    time: fmtTime(p.t),
    온도: p.temperature,
    체감온도: p.feels_like,
    습도: p.humidity,
  }));
  const th = kpi?.thresholds;

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-200">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-slate-700">시계열 분석 (온·습도 / 체감온도)</h3>
        <span className="text-xs text-slate-400">
          {ts ? `${ts.interval_minutes}분 평균 다운샘플링` : ""}
        </span>
      </div>
      {data.length === 0 ? (
        <div className="flex h-72 items-center justify-center text-slate-400">데이터가 없습니다.</div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} minTickGap={40} />
            <YAxis yAxisId="temp" tick={{ fontSize: 11 }} unit="℃"
                   domain={["auto", "auto"]} label={{ value: "온도", angle: -90, position: "insideLeft", fontSize: 11 }} />
            <YAxis yAxisId="humi" orientation="right" tick={{ fontSize: 11 }} unit="%"
                   domain={[0, 100]} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area yAxisId="humi" type="monotone" dataKey="습도" fill="#bae6fd" stroke="#38bdf8"
                  fillOpacity={0.35} dot={false} />
            <Line yAxisId="temp" type="monotone" dataKey="온도" stroke="#2563eb" dot={false} strokeWidth={1.5} />
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
