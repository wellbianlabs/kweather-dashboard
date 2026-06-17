// 카탈로그 "일일 보고서 리디자인" 워크스페이스용 샘플 데이터.
// - SAMPLE_DAILY: 웹 WebReport(프론트 DailyReport) 입력
// - SAMPLE_PDF: PDF 템플릿(백엔드 `d` 와 동일 필드명) 입력 → HTML 리디자인 후 Jinja2 포팅이 기계적
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

// 일중 체감온도(°C) — 새벽 저온 → 14시 피크 38.6, 외부 기온 곡선
const FEELS = [27.1, 26.5, 26.0, 25.6, 25.4, 25.8, 26.9, 28.4, 30.6, 32.8, 34.7, 36.2, 37.5, 38.2, 38.6, 38.3, 37.4, 36.0, 34.2, 32.4, 30.9, 29.7, 28.6, 27.8];
const OUT = [24.0, 23.6, 23.2, 22.9, 22.8, 23.1, 24.0, 25.3, 27.2, 29.0, 30.5, 31.6, 32.5, 33.0, 33.2, 33.0, 32.3, 31.2, 29.8, 28.3, 27.0, 26.0, 25.1, 24.4];

const hours: DailyHourPoint[] = FEELS.map((feels, h) => {
  const lv = classify(feels);
  return { hour: h, feels, temperature: +(feels - 2.4).toFixed(1), level: lv.code, color: lv.color };
});

export const SAMPLE_SN = "DEMO-A001";

const GUIDANCE = [
  "체감온도 38℃ 이상 시간대(14~15시)에는 옥외·고열 작업을 중지하고 즉시 그늘·냉방 공간에서 휴식하십시오.",
  "근무시간 중 2시간마다 20분 이상 휴식을 부여하고, 휴식 시간을 작업일지에 기록하십시오.",
  "시원한 물을 상시 비치하고 작업자에게 15~20분 간격으로 수분 섭취를 독려하십시오.",
  "정련로 주변 복사열 차단을 위한 차열판·국소냉방·환기 설비를 점검하십시오.",
  "온열질환 의심 증상(두통·어지럼·경련) 발생 시 즉시 작업을 중단하고 119에 신고하십시오.",
];

export const SAMPLE_DAILY: DailyReport = {
  device_sn: SAMPLE_SN,
  date: "2026-06-16",
  company_name: "데모 제강(주)",
  location_name: "제2공장 정련로 앞",
  max_feels_like: 38.6,
  max_feels_like_time: "14:20",
  max_temperature: 36.2,
  avg_humidity: 58,
  minutes_over_31: 11 * 60,
  minutes_over_33: 8 * 60 + 30,
  minutes_over_35: 5 * 60,
  minutes_over_38: 84,
  hours,
  work_hot_minutes: 6 * 60 + 30,
  legal_rest_count: 4,
  legal_rest_minutes: 80,
  peak_level: LV.danger,
  guidance: GUIDANCE,
};

// 백엔드 _daily_detail() 의 `d` 와 동일 필드명 — 리디자인 HTML 을 Jinja2 로 포팅 시 1:1.
export const SAMPLE_PDF = {
  company_name: "데모 제강(주)",
  location_name: "제2공장 정련로 앞",
  address: "부산광역시 사하구 산업로 123",
  device_sn: SAMPLE_SN,
  date: "2026-06-16",
  has_data: true,
  range_start: "00:00",
  range_end: "23:50",
  record_count: 144,
  peak_color: "#dc2626",
  peak_label: "위험",
  max_feels: 38.6,
  max_time: "14:20",
  max_temp: 36.2,
  levels: {
    attention: { color: "#84cc16", label: "관심" },
    caution: { color: "#eab308", label: "주의" },
    warning: { color: "#f97316", label: "경고" },
    danger: { color: "#dc2626", label: "위험" },
  },
  level_minutes_label: { attention: "11시간 0분", caution: "8시간 30분", warning: "5시간 0분", danger: "1시간 24분" },
  work: {
    max_feels: 38.6, max_time: "14:20", max_temp: 36.2, peak_color: "#dc2626",
    minutes_label: { attention: "6시간 30분", caution: "5시간 0분", warning: "3시간 10분", danger: "1시간 24분" },
    hot_minutes: 390, hot_label: "6시간 30분", legal_rest_count: 4, legal_rest_label: "1시간 20분",
  },
  hours: hours.map((h, i) => ({ hour: h.hour, feels: h.feels ?? 0, color: h.color, out_feels: OUT[i], outdoor: OUT[i], delta: +((h.feels ?? 0) - OUT[i]).toFixed(1) })),
  external_daily: { out_feels_max: 33.2, out_max: 31.0, out_avg: 27.6, in_max: 36.2, in_avg: 31.2, diff_feels: 5.4, diff_max: 5.2, source: "케이웨더(주) 기상관측자료" },
  weather: { enclosed_alert: true, feels_based: true, max_delta: 6.1, avg_delta: 4.3, threshold: 3.0, provider: "kweather" },
  analysis: [
    "근무시간(09~18시) 중 체감온도 38℃ 이상(위험단계) 노출이 1시간 24분 발생하여 온열질환 고위험 상태였습니다.",
    "작업장 최고 체감온도(38.6℃)가 외부 기상청 공식 체감온도(33.2℃) 대비 +5.4℃ 높아 복사열·밀폐 영향이 큰 사업장으로 분석됩니다.",
    "산업안전보건규칙에 따른 법정 최소 휴식(4회·총 1시간 20분) 부여 의무가 발생했습니다.",
  ],
  guidance: GUIDANCE,
};
export type PdfData = typeof SAMPLE_PDF;
