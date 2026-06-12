import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { WeatherCompare } from "../types";
import { IconAlert } from "./Icons";

function fmtTime(t: string) {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function WeatherCompareChart({ cmp }: { cmp: WeatherCompare | null }) {
  const data = (cmp?.points || []).map((p) => ({
    time: fmtTime(p.t),
    "현장 체감온도": p.indoor_feels_like,
    "야외 체감온도": p.outdoor_feels,
    "야외 기온": p.outdoor_temperature,
    "체감온도 격차": p.delta,
  }));
  const hasOutFeels = data.some((d) => d["야외 체감온도"] != null);

  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">야외 vs 현장(내부) 체감온도 비교 <span className="font-normal text-slate-400">— 기상청 공식 외부 체감온도 매칭</span></h3>
        <span className="text-xs text-slate-400">데이터 제공: 케이웨더(주)</span>
      </div>

      {cmp?.enclosed_alert && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <IconAlert className="mr-1.5 inline h-4 w-4 -translate-y-px" /> <b>밀폐형 폭염 사업장 경고</b> — 현장 체감온도가 야외 체감온도보다 최대 {cmp.max_delta}℃ 높습니다
          (임계 {cmp.enclosed_threshold}℃ 초과). 환기·냉방 대책이 필요합니다.
        </div>
      )}

      {data.length === 0 ? (
        <div className="flex h-72 items-center justify-center text-slate-400">데이터가 없습니다.</div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} minTickGap={40} />
            <YAxis tick={{ fontSize: 11 }} unit="℃" />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="체감온도 격차" fill="#fecaca" barSize={10} />
            <Line type="monotone" dataKey="현장 체감온도" stroke="#dc2626" dot={false} strokeWidth={2.2} />
            {hasOutFeels && <Line type="monotone" dataKey="야외 체감온도" stroke="#1790cd" dot={false} strokeWidth={2.2} />}
            <Line type="monotone" dataKey="야외 기온" stroke="#94a3b8" strokeDasharray="5 4" dot={false} strokeWidth={1.4} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
