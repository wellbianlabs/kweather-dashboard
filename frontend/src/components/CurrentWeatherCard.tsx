import type { CurrentWeather } from "../types";
import { HeatBadge } from "./HeatBadge";

export function CurrentWeatherCard({ cw }: { cw: CurrentWeather | null }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-200">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-slate-700">현재 야외 날씨 · 실시간 폭염지수</h3>
        <span className="text-xs text-slate-400">
          {cw?.region || ""} {cw?.observed_at ? `· ${cw.observed_at}` : ""}
        </span>
      </div>

      {cw && cw.available ? (
        <>
          {/* 야외 실시간 폭염 위험단계 */}
          {cw.outdoor_level && (
            <div className="mb-3 flex items-center gap-3 rounded-lg p-3"
                 style={{ background: `${cw.outdoor_level.color}14` }}>
              <span className="text-xs font-medium text-slate-500">야외 폭염 위험단계</span>
              <HeatBadge level={cw.outdoor_level} size="lg" />
              <span className="text-sm text-slate-500">체감 {cw.outdoor_feels?.toFixed(1)}℃ 기준</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Cell label="야외 기온" value={cw.outdoor_temp} unit="℃" />
            <Cell label="야외 체감온도" value={cw.outdoor_feels} unit="℃"
                  accent={cw.outdoor_level?.color} />
            <Cell label="야외 습도" value={cw.outdoor_humidity} unit="%" />
            <Cell label="현장 체감온도(최신)" value={cw.indoor_feels} unit="℃" accent="#dc2626"
                  sub={cw.indoor_at ?? undefined} />
          </div>
          {cw.delta != null && (
            <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              cw.enclosed_alert ? "border border-red-200 bg-red-50 text-red-700"
              : "border border-slate-200 bg-slate-50 text-slate-600"}`}>
              {cw.enclosed_alert ? "⚠️ " : "· "}
              현장 체감온도가 야외보다 <b>{cw.delta > 0 ? `${cw.delta}℃ 높음` : `${Math.abs(cw.delta)}℃ 낮음`}</b>
              {cw.enclosed_alert && ` — 밀폐형 폭염 사업장(임계 ${cw.enclosed_threshold}℃ 초과). 환기·냉방 대책 필요`}
            </div>
          )}
          <div className="mt-2 text-right text-[10px] text-slate-400">
            로우데이터 제공: <b className="text-slate-500">기상청</b> · 정보제공: 케이웨더
          </div>
        </>
      ) : (
        <p className="py-4 text-center text-sm text-slate-400">
          {cw?.message || "현재 야외 날씨를 불러올 수 없습니다."}
        </p>
      )}
    </div>
  );
}

function Cell({ label, value, unit, accent, sub }: {
  label: string; value: number | null; unit: string; accent?: string; sub?: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="text-xl font-bold" style={{ color: accent || "#0f172a" }}>
          {value == null ? "-" : value.toFixed(1)}
        </span>
        <span className="text-xs text-slate-400">{unit}</span>
      </div>
      {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
    </div>
  );
}
