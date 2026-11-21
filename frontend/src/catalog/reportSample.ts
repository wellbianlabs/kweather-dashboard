// 리포트 스튜디오(standalone) 데이터 — 파라미터 기반 빌더. 각 값을 임의 입력해 웹/PDF 미리보기.
// - buildReportData(params): 핵심 파라미터로 24h 곡선 + 전 섹션 데이터 생성
// - SAMPLE_DAILY/SAMPLE_PDF: 기본 파라미터 인스턴스(타입 추론·하위호환)
import type { DailyReport, DailyHourPoint, HeatLevel } from "../types";

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
export function fmtMin(m: number): string {
  if (!m || m <= 0) return "0분";
  const h = Math.floor(m / 60), mm = m % 60;
  return h > 0 ? `${h}시간 ${mm}분` : `${mm}분`;
}

export interface ReportParams {
  company: string;
  location: string;
  address: string;
  date: string;
  sn: string;
  baseFeels: number;   // 새벽 최저 체감(°C)
  peakFeels: number;   // 최고 체감(°C)
  peakHour: number;    // 피크 시각(0~23)
  maxTemp: number;     // 최고 기온(°C)
  extDiff: number;     // 외부 대비 체감차(내-외, °C) → 외부 체감 = 내부 - extDiff
  humidity: number;    // 평균 습도(%)
}

export const DEFAULT_PARAMS: ReportParams = {
  company: "데모 제강(주)",
  location: "제2공장 정련로 앞",
  address: "부산광역시 사하구 산업로 123",
  date: "2026-06-16",
  sn: "DEMO-A001",
  baseFeels: 26,
  peakFeels: 38.6,
  peakHour: 14,
  maxTemp: 36.2,
  extDiff: 5.4,
  humidity: 58,
};

/** 일중 체감 곡선 — 새벽 저온 → peakHour 피크 → 야간 하강(코사인 범프). */
function curveAt(base: number, peak: number, peakHour: number, h: number): number {
  const amp = peak - base;
  const dist = Math.min(Math.abs(h - peakHour), 24 - Math.abs(h - peakHour));
  const w = Math.cos(Math.min(dist / 9, 1) * (Math.PI / 2)); // 1=피크, 0=먼 시각
  return +(base + amp * Math.pow(Math.max(0, w), 1.4)).toFixed(1);
}

const GUIDANCE = [
  "체감온도 38℃ 이상 시간대에는 옥외·고열 작업을 중지하고 즉시 그늘·냉방 공간에서 휴식하십시오.",
  "근무시간 중 2시간마다 20분 이상 휴식을 부여하고, 휴식 시간을 작업일지에 기록하십시오.",
  "시원한 물을 상시 비치하고 작업자에게 15~20분 간격으로 수분 섭취를 독려하십시오.",
  "복사열 차단을 위한 차열판·국소냉방·환기 설비를 점검하십시오.",
  "온열질환 의심 증상(두통·어지럼·경련) 발생 시 즉시 작업을 중단하고 119에 신고하십시오.",
];

export function buildReportData(p: ReportParams) {
  const feels = Array.from({ length: 24 }, (_, h) => curveAt(p.baseFeels, p.peakFeels, p.peakHour, h));
  const outFeels = feels.map((f) => +(f - p.extDiff).toFixed(1)); // 기상청 외부 체감
  const hours: DailyHourPoint[] = feels.map((f, h) => {
    const lv = classify(f);
    return { hour: h, feels: f, temperature: +(f - 2.4).toFixed(1), level: lv.code, color: lv.color };
  });
  const overMin = (th: number) => feels.filter((f) => f >= th).length * 60;
  const workIdx = Array.from({ length: 9 }, (_, i) => i + 9); // 09~17
  const workFeels = workIdx.map((h) => feels[h]);
  const workOver = (th: number) => workFeels.filter((f) => f >= th).length * 60;
  const workHot = workOver(33);
  const legalCount = Math.floor(workHot / 120);
  const legalMin = legalCount * 20;
  const peakLv = classify(p.peakFeels);
  const maxTime = `${String(p.peakHour).padStart(2, "0")}:20`;
  const outMax = +(p.maxTemp - p.extDiff).toFixed(1);
  const avgFeels = +(feels.reduce((s, v) => s + v, 0) / 24).toFixed(1);

  const daily: DailyReport = {
    device_sn: p.sn, date: p.date, company_name: p.company, location_name: p.location, address: null,
    max_feels_like: p.peakFeels, max_feels_like_time: maxTime, max_temperature: p.maxTemp, avg_humidity: p.humidity,
    minutes_over_31: overMin(31), minutes_over_33: overMin(33), minutes_over_35: overMin(35), minutes_over_38: overMin(38),
    hours, work_hot_minutes: workHot, legal_rest_count: legalCount, legal_rest_minutes: legalMin,
    peak_level: peakLv, guidance: GUIDANCE,
  };

  const pdf = {
    company_name: p.company, location_name: p.location, address: p.address, device_sn: p.sn, date: p.date,
    has_data: true, range_start: "00:00", range_end: "23:50", record_count: 144,
    peak_color: peakLv.color, peak_label: peakLv.label,
    max_feels: p.peakFeels, max_time: maxTime, max_temp: p.maxTemp,
    levels: {
      attention: { color: "#84cc16", label: "관심" }, caution: { color: "#eab308", label: "주의" },
      warning: { color: "#f97316", label: "경고" }, danger: { color: "#dc2626", label: "위험" },
    },
    level_minutes_label: {
      attention: fmtMin(overMin(31)), caution: fmtMin(overMin(33)), warning: fmtMin(overMin(35)), danger: fmtMin(overMin(38)),
    },
    work: {
      max_feels: Math.max(...workFeels), max_time: maxTime, max_temp: p.maxTemp, peak_color: peakLv.color,
      minutes_label: {
        attention: fmtMin(workOver(31)), caution: fmtMin(workOver(33)), warning: fmtMin(workOver(35)), danger: fmtMin(workOver(38)),
      },
      hot_minutes: workHot, hot_label: fmtMin(workHot), legal_rest_count: legalCount, legal_rest_label: fmtMin(legalMin),
    },
    hours: hours.map((h, i) => ({ hour: h.hour, feels: h.feels ?? 0, color: h.color, out_feels: outFeels[i], outdoor: outFeels[i], delta: +((h.feels ?? 0) - outFeels[i]).toFixed(1) })),
    external_daily: {
      out_feels_max: Math.max(...outFeels), out_max: outMax, out_avg: +(avgFeels - p.extDiff).toFixed(1),
      in_max: p.maxTemp, in_avg: +(avgFeels - 2.4).toFixed(1), diff_feels: p.extDiff, diff_max: +(p.maxTemp - outMax).toFixed(1),
      source: "케이웨더(주) 기상관측자료",
    },
    weather: {
      enclosed_alert: p.extDiff >= 3, feels_based: true, max_delta: +(p.extDiff + 0.7).toFixed(1),
      avg_delta: +(p.extDiff - 1.1).toFixed(1), threshold: 3.0, provider: "kweather",
    },
    analysis: [
      `근무시간(09~18시) 중 체감온도 38℃ 이상(위험단계) 노출이 ${fmtMin(workOver(38))} 발생했습니다.`,
      `작업장 최고 체감온도(${p.peakFeels}℃)가 외부 기상청 공식 체감온도(${Math.max(...outFeels)}℃) 대비 +${p.extDiff}℃ 높아 복사열·밀폐 영향이 큰 사업장으로 분석됩니다.`,
      legalCount > 0
        ? `산업안전보건규칙에 따른 법정 최소 휴식(${legalCount}회·총 ${fmtMin(legalMin)}) 부여 의무가 발생했습니다.`
        : "근무시간 중 체감 33℃ 이상 작업이 없어 추가 의무 휴식 대상은 아닙니다.",
    ],
    guidance: GUIDANCE,
  };

  return { daily, pdf, sn: p.sn };
}

const _DEFAULT = buildReportData(DEFAULT_PARAMS);
export const SAMPLE_DAILY = _DEFAULT.daily;
export const SAMPLE_PDF = _DEFAULT.pdf;
export const SAMPLE_SN = DEFAULT_PARAMS.sn;
export type PdfData = typeof SAMPLE_PDF;
