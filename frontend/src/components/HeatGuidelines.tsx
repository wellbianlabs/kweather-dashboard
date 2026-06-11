import type { Kpi } from "../types";
import { IconShield } from "./Icons";

/* 정부 발표 폭염 단계별 대응 지침
   근거: 고용노동부 「온열질환 예방가이드」(물·그늘·휴식 3대 기본수칙),
        산업안전보건기준에 관한 규칙 제566조(휴식 등),
        기상청 폭염특보 발표 기준 */
const GUIDELINES = [
  {
    code: "attention", label: "관심", range: "31℃ 이상", color: "#84cc16",
    actions: ["옥외작업자에게 충분한 음용수 제공", "그늘진 휴게장소 사전 확보", "온열질환 민감군(고령·기저질환) 사전 파악"],
  },
  {
    code: "caution", label: "주의", range: "33℃ 이상", color: "#facc15",
    actions: ["매시간 10분 이상 그늘에서 휴식 부여", "무더위 시간대(14~17시) 옥외작업 단축 검토", "근로자 건강상태 수시 확인"],
  },
  {
    code: "warning", label: "경고", range: "35℃ 이상", color: "#f97316",
    actions: ["매시간 15분 이상 휴식 부여", "무더위 시간대 불요불급한 옥외작업 중지", "작업시간 조정(아침·저녁 시간대 전환) 시행"],
  },
  {
    code: "danger", label: "위험", range: "38℃ 이상", color: "#dc2626",
    actions: ["긴급조치 작업 외 옥외작업 원칙적 중지", "매시간 15분 이상 휴식 및 작업 전 건강상태 확인", "온열질환 의심 증상 시 즉시 작업 중단·응급조치(119)"],
  },
];

export function HeatGuidelines({ kpi }: { kpi: Kpi | null }) {
  const current = kpi?.current_level?.code;
  return (
    <div className="card">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900">
          <IconShield className="h-4.5 w-4.5 h-5 w-5 text-kw" />
          폭염 단계별 안전조치 기준 <span className="font-normal text-slate-400">— 정부 발표 지침</span>
        </h3>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-slate-500">
        고용노동부 온열질환 예방 3대 기본수칙 <b className="text-slate-700">물 · 그늘 · 휴식</b> ·
        기상청 폭염특보 기준: 주의보(체감 33℃ 이상 2일 지속 예상) / 경보(체감 35℃ 이상 2일 지속 예상)
      </p>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {GUIDELINES.map((g) => {
          const active = current === g.code;
          return (
            <div key={g.code}
                 className={`rounded-xl border p-4 transition ${active ? "shadow-lift" : "border-slate-200/70"}`}
                 style={active ? { borderColor: g.color, background: `${g.color}0d` } : undefined}>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-sm font-bold" style={{ color: g.color }}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.color }} />
                  {g.label}
                </span>
                <span className="text-xs font-medium text-slate-400">체감 {g.range}</span>
              </div>
              {active && (
                <div className="mt-1.5 inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold text-white"
                     style={{ background: g.color }}>
                  현재 해당 단계
                </div>
              )}
              <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-slate-600">
                {g.actions.map((a, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-slate-300" />{a}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="mt-4 border-t border-slate-100 pt-3 text-right text-[11px] text-slate-400">
        근거: 고용노동부 「온열질환 예방가이드」 · 산업안전보건기준에 관한 규칙 제566조 · 기상청 폭염특보 발표 기준
      </p>
    </div>
  );
}
