// 기간 통계 보고서 데이터 — 파라미터 기반 빌더(임의 값 입력). 웹/PDF 공용.
import type { HeatLevel } from "../types";

const LV: Record<string, HeatLevel> = {
  safe: { code: "safe", label: "안전", color: "#16a34a", rank: 0 },
  attention: { code: "attention", label: "관심", color: "#84cc16", rank: 1 },
  caution: { code: "caution", label: "주의", color: "#eab308", rank: 2 },
  warning: { code: "warning", label: "경고", color: "#f97316", rank: 3 },
  danger: { code: "danger", label: "위험", color: "#dc2626", rank: 4 },
};
function classify(f: number): HeatLevel {
  if (f >= 38) return LV.danger;
  if (f >= 35) return LV.warning;
  if (f >= 33) return LV.caution;
  if (f >= 31) return LV.attention;
  return LV.safe;
}
export const PERIODIC_CODES = ["attention", "caution", "warning", "danger"] as const;
export const PERIODIC_LEVELS = LV;

function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export interface PeriodicParams {
  company: string;
  location: string;
  sn: string;
  startDate: string;
  days: number;        // 분석 일수
  baseMaxFeels: number; // 기간 중 일 최고 체감 하한(°C)
  peakMaxFeels: number; // 기간 중 일 최고 체감 상한(°C)
}

export const PERIODIC_DEFAULT: PeriodicParams = {
  company: "데모 제강(주)",
  location: "제2공장 정련로 앞",
  sn: "DEMO-A001",
  startDate: "2026-06-09",
  days: 8,
  baseMaxFeels: 31.5,
  peakMaxFeels: 39.2,
};

export interface PeriodicDailyRow {
  date: string;
  max_feels: number;
  max_temp: number;
  minutes_over_33: number;
  level: HeatLevel;
}

export function buildPeriodicData(p: PeriodicParams) {
  const n = Math.max(1, Math.min(31, Math.round(p.days)));
  const amp = p.peakMaxFeels - p.baseMaxFeels;
  const daily: PeriodicDailyRow[] = Array.from({ length: n }, (_, i) => {
    // 기간 중반 피크 + 소폭 일변동(결정적)
    const bump = Math.sin((i / Math.max(1, n - 1)) * Math.PI);          // 0→1→0
    const jit = 0.5 * Math.sin(i * 1.7) + 0.3 * Math.sin(i * 0.6);       // ±0.8
    const mf = +(p.baseMaxFeels + amp * (0.45 + 0.55 * bump) + jit).toFixed(1);
    const lv = classify(mf);
    const over = Math.round(Math.max(0, (mf - 33) * 28));                 // 33↑ 노출 근사(분)
    return { date: addDays(p.startDate, i), max_feels: mf, max_temp: +(mf - 2.6).toFixed(1), minutes_over_33: lv.rank >= 2 ? over : 0, level: lv };
  });

  const endDate = addDays(p.startDate, n - 1);
  const overallMax = Math.max(...daily.map((d) => d.max_feels));
  const levelCounts: Record<string, number> = { attention: 0, caution: 0, warning: 0, danger: 0 };
  daily.forEach((d) => { PERIODIC_CODES.forEach((c) => { if (d.max_feels >= ({ attention: 31, caution: 33, warning: 35, danger: 38 } as const)[c]) levelCounts[c] += 1; }); });
  const dangerDays = levelCounts.danger;
  const peakLv = classify(overallMax);

  const reportNo = `KW-HSP-${p.startDate.replace(/-/g, "")}-${p.sn.slice(-4)}`;
  const analysis = [
    `분석 기간 ${n}일 중 일 최고 체감온도가 위험단계(38℃ 이상)에 도달한 날이 ${dangerDays}일, 경고단계(35℃↑) 이상이 ${levelCounts.warning}일이었습니다.`,
    `기간 최고 체감온도는 ${overallMax}℃(${daily.find((d) => d.max_feels === overallMax)?.date})로 측정되었습니다.`,
    dangerDays > 0
      ? "위험단계 도달일에는 옥외·고열 작업 중지 및 시간대 조정, 법정 휴식(2시간당 20분) 준수가 필요합니다."
      : "전 기간 위험단계 미도달이나, 경고·주의 단계 작업일의 수분·휴식 관리는 지속 권장됩니다.",
  ];

  return {
    company: p.company, location: p.location, sn: p.sn,
    start: p.startDate, end: endDate, days: n, reportNo,
    overall_max_feels: overallMax, peak_level: peakLv,
    level_counts: levelCounts, danger_days: dangerDays,
    daily, analysis,
  };
}

export type PeriodicData = ReturnType<typeof buildPeriodicData>;
