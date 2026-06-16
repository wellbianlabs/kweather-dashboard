// 레이아웃 목업용 정적 데이터 (API 불필요) — 재설계 대시보드 와이어 검증용
import type { Kpi, TimeSeries, WeatherCompare } from "../types";

const TH = { attention: 31, caution: 33, warning: 35, danger: 38 };

export const mockKpi: Kpi = {
  device_sn: "DEMO-A001",
  company_name: "데모 제강(주)",
  location_name: "제2공장 정련로 앞",
  range_start: "2026-06-16",
  range_end: "2026-06-16",
  record_count: 540,
  max_feels_like: 38.6,
  max_temperature: 36.2,
  avg_humidity: 68,
  avg_feels_like: 31.4,
  current_level: { code: "danger", label: "위험", color: "#dc2626", rank: 4 },
  thresholds: TH,
};

function buildSeries(): TimeSeries {
  const points = [];
  for (let m = 0; m <= 23 * 60; m += 10) {
    const h = m / 60;
    const diurnal = Math.sin(((h - 9) / 24) * 2 * Math.PI);
    const temp = 27 + 8 * diurnal + 3 * Math.max(0, diurnal);
    const feels = temp + 2.5 + 2 * Math.max(0, diurnal);
    const humi = Math.max(40, Math.min(85, 62 - 16 * diurnal));
    const hh = String(Math.floor(h)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    points.push({
      t: `2026-06-16T${hh}:${mm}:00`,
      temperature: Math.round(temp * 10) / 10,
      feels_like: Math.round(feels * 10) / 10,
      humidity: Math.round(humi),
    });
  }
  return { device_sn: "DEMO-A001", interval_minutes: 10, points };
}

export const mockTs = buildSeries();

export const mockCmp: WeatherCompare = (() => {
  const points = mockTs.points
    .filter((_, i) => i % 3 === 0)
    .map((p) => {
      const outdoor = (p.temperature ?? 28) - 4.2;
      const outFeels = outdoor + 1.5;
      const delta = (p.feels_like ?? 0) - outFeels;
      return {
        t: p.t,
        indoor_feels_like: p.feels_like,
        outdoor_temperature: Math.round(outdoor * 10) / 10,
        outdoor_feels: Math.round(outFeels * 10) / 10,
        delta: Math.round(delta * 10) / 10,
      };
    });
  const max_delta = Math.round(Math.max(...points.map((p) => p.delta ?? 0)) * 10) / 10;
  return {
    device_sn: "DEMO-A001",
    provider: "kweather",
    interval_minutes: 30,
    points,
    max_delta,
    enclosed_alert: true,
    enclosed_threshold: 5,
  };
})();

// 7일 시간단위 — N일 범위 '일자 라벨' 데모용
export const mockTsWeek: TimeSeries = (() => {
  const dayList = ["2026-06-09", "2026-06-10", "2026-06-11", "2026-06-12", "2026-06-13", "2026-06-14", "2026-06-15"];
  const p2 = (n: number) => String(n).padStart(2, "0");
  const points = [];
  for (let di = 0; di < dayList.length; di++) {
    const dayFactor = 0.86 + 0.035 * di; // 일자별 상승 추세
    for (let h = 0; h < 24; h++) {
      const diurnal = Math.sin(((h - 9) / 24) * 2 * Math.PI);
      const temp = (26 + 8 * diurnal + 3 * Math.max(0, diurnal)) * dayFactor;
      const feels = temp + 2.5 + 2 * Math.max(0, diurnal);
      const humi = Math.max(40, Math.min(85, 62 - 16 * diurnal));
      points.push({
        t: `${dayList[di]}T${p2(h)}:00:00`,
        temperature: Math.round(temp * 10) / 10,
        feels_like: Math.round(feels * 10) / 10,
        humidity: Math.round(humi),
      });
    }
  }
  return { device_sn: "DEMO-A001", interval_minutes: 60, points };
})();
