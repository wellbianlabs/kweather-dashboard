import type { Kpi } from "../types";
import { IconCheck } from "./Icons";

/* 정부 발표 폭염 단계별 대응 지침
   근거: 고용노동부 「2026 폭염 대비 노동자 건강보호 대책」(2026.5.13.),
        산업안전보건기준에 관한 규칙 제566조, 기상청 폭염특보(중대경보 신설) */
const GUIDELINES = [
  {
    code: "attention", label: "관심", temp: "31", color: "#84cc16",
    advisory: "예방 단계", summary: "예방수칙 가동",
    actions: ["폭염안전 5대 기본수칙 점검", "그늘·냉방 휴게장소 사전 확보", "민감군(고령·기저질환) 사전 파악"],
  },
  {
    code: "caution", label: "주의", temp: "33", color: "#eab308",
    advisory: "폭염주의보", summary: "2시간마다 20분 휴식",
    actions: ["2시간마다 20분 이상 휴식 (법적 의무)", "작업시간대 조정·옥외작업 단축", "충분한 음용수·건강상태 수시 확인"],
  },
  {
    code: "warning", label: "경고", temp: "35", color: "#f97316",
    advisory: "폭염경보", summary: "14~17시 옥외작업 중지",
    actions: ["무더위 시간대(14~17시) 옥외작업 중지", "2시간마다 20분 이상 휴식", "작업시간 조기·야간 전환"],
  },
  {
    code: "danger", label: "위험", temp: "38", color: "#dc2626",
    advisory: "폭염중대경보 (신설)", summary: "옥외작업 중지",
    actions: ["긴급조치 작업 외 옥외작업 중지", "2시간마다 20분 휴식·건강상태 확인", "의심 증상 시 즉시 중단·119"],
  },
];

/* 폭염안전 5대 기본수칙 (산업안전보건규칙 개정으로 법제화된 사업주 보건조치) */
const RULES = [
  { k: "물", d: "시원한 물" },
  { k: "냉방", d: "냉방장치" },
  { k: "휴식", d: "2시간마다 20분" },
  { k: "보냉", d: "개인 보냉장구" },
  { k: "119", d: "응급 신고" },
];

export function HeatGuidelines({ kpi }: { kpi: Kpi | null }) {
  const current = kpi?.current_level?.code;
  const activeIdx = GUIDELINES.findIndex((g) => g.code === current);

  return (
    <div className="card !p-6">
      {/* 헤더 + 3대 수칙 */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-extrabold tracking-tight text-slate-900">폭염 단계별 안전조치 기준</h3>
          <p className="mt-1 text-[13px] text-slate-400">
            고용노동부 「2026 폭염 대비 노동자 건강보호 대책」 · 폭염특보: 주의보 33℃ / 경보 35℃ / 중대경보 38℃(신설) · 체감 33℃↑ 작업 시 2시간마다 20분 휴식 법제화
          </p>
        </div>
        <div className="shrink-0">
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">폭염안전 5대 기본수칙 · 법적 의무</div>
          <div className="flex flex-wrap gap-2">
            {RULES.map((r) => (
              <div key={r.k} className="rounded-2xl bg-kw-50 px-3.5 py-2.5 text-center">
                <div className="text-sm font-extrabold leading-tight text-kw">{r.k}</div>
                <div className="mt-0.5 text-[10px] font-medium text-kw/60">{r.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 단계 스펙트럼 바 */}
      <div className="mt-5">
        <div className="flex overflow-hidden rounded-full">
          {GUIDELINES.map((g, i) => (
            <div key={g.code} className="relative h-3 flex-1 transition-all"
                 style={{ background: g.color, opacity: activeIdx === -1 || activeIdx === i ? 1 : 0.25 }} />
          ))}
        </div>
        <div className="mt-1.5 flex text-[11px] font-semibold text-slate-400">
          {GUIDELINES.map((g) => (
            <div key={g.code} className="flex-1">체감 {g.temp}℃~</div>
          ))}
        </div>
      </div>

      {/* 단계 카드 */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {GUIDELINES.map((g) => {
          const active = current === g.code;
          return (
            <div key={g.code}
                 className={`overflow-hidden rounded-2xl border bg-white transition ${
                   active ? "border-transparent shadow-lift ring-2" : "border-slate-200/70 shadow-card"
                 }`}
                 style={active ? ({ ["--tw-ring-color" as any]: g.color }) : undefined}>
              {/* 컬러 헤더 밴드 */}
              <div className="px-5 pb-3 pt-4 text-white"
                   style={{ background: `linear-gradient(135deg, ${g.color}, ${g.color}d9)` }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[19px] font-extrabold leading-none tracking-tight">{g.label}</span>
                      <span className="rounded bg-white/25 px-1.5 py-0.5 text-[9px] font-bold leading-none">{g.advisory}</span>
                    </div>
                    <div className="mt-1.5 text-[11px] font-semibold text-white/85">{g.summary}</div>
                  </div>
                  <div className="text-right leading-none">
                    <span className="text-[30px] font-extrabold tracking-tight">{g.temp}</span>
                    <span className="text-sm font-bold text-white/85">℃~</span>
                  </div>
                </div>
                {active && (
                  <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-extrabold"
                       style={{ color: g.color }}>
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                            style={{ background: g.color }} />
                      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: g.color }} />
                    </span>
                    현재 해당 단계
                  </div>
                )}
              </div>
              {/* 조치사항 */}
              <ul className="space-y-2.5 px-5 py-4">
                {g.actions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] font-medium leading-snug text-slate-700">
                    <span className="mt-0.5 shrink-0" style={{ color: g.color }}>
                      <IconCheck className="h-3.5 w-3.5" />
                    </span>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="mt-5 border-t border-slate-100 pt-3 text-right text-[11px] text-slate-400">
        근거: 고용노동부 「2026 폭염 대비 노동자 건강보호 대책」(2026.5.13.) · 산업안전보건기준에 관한 규칙 제566조 · 기상청 폭염특보(중대경보 신설)
      </p>
    </div>
  );
}
