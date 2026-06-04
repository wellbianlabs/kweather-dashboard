import type {
  Device,
  Kpi,
  TimeSeries,
  MapMarker,
  WeatherCompare,
  UploadResult,
  DailyReport,
} from "./types";

// 데모 테넌트 키. 실제 환경에서는 로그인/발급된 키로 대체.
const API_KEY = localStorage.getItem("kw_api_key") || "demo-key";
// 배포 시 백엔드 URL(VITE_API_BASE). 로컬/단일오리진은 빈 값(개발 시 Vite 프록시가 8000으로 전달).
const BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") || "";

// 모든 요청 경로에 BASE 접두
const u = (path: string) => BASE + path;

function headers(extra: Record<string, string> = {}) {
  return { "X-API-Key": API_KEY, ...extra };
}

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(u(url), { headers: headers() });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

export const api = {
  apiKey: API_KEY,

  health: () => getJSON<any>("/api/health"),

  listDevices: () => getJSON<Device[]>("/api/devices"),

  updateDevice: async (sn: string, patch: Partial<Device>): Promise<Device> => {
    const r = await fetch(u(`/api/devices/${encodeURIComponent(sn)}`), {
      method: "PUT",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(patch),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  kpi: (deviceSn: string | null, start?: string, end?: string) => {
    const p = new URLSearchParams();
    if (deviceSn) p.set("device_sn", deviceSn);
    if (start) p.set("start", start);
    if (end) p.set("end", end);
    return getJSON<Kpi>(`/api/dashboard/kpi?${p}`);
  },

  timeseries: (deviceSn: string, start: string, end: string, interval: number) => {
    const p = new URLSearchParams({ device_sn: deviceSn, start, end, interval: String(interval) });
    return getJSON<TimeSeries>(`/api/dashboard/timeseries?${p}`);
  },

  map: (onDate?: string) => {
    const p = new URLSearchParams();
    if (onDate) p.set("on_date", onDate);
    return getJSON<MapMarker[]>(`/api/dashboard/map?${p}`);
  },

  weatherCompare: (deviceSn: string, start: string, end: string, interval: number) => {
    const p = new URLSearchParams({ device_sn: deviceSn, start, end, interval: String(interval) });
    return getJSON<WeatherCompare>(`/api/weather/compare?${p}`);
  },

  dailyReport: (deviceSn: string, onDate: string) => {
    const p = new URLSearchParams({ device_sn: deviceSn, on_date: onDate });
    return getJSON<DailyReport>(`/api/reports/daily?${p}`);
  },

  upload: async (files: FileList | File[]): Promise<UploadResult[]> => {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("files", f));
    const r = await fetch(u("/api/upload"), { method: "POST", headers: headers(), body: fd });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  // 다운로드 URL (브라우저가 직접 받도록). X-API-Key 헤더 대신 fetch 후 blob 처리.
  download: async (url: string, filename: string) => {
    const r = await fetch(u(url), { headers: headers() });
    if (!r.ok) throw new Error(await r.text());
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  dailyPdfUrl: (sn: string, d: string) => `/api/reports/daily.pdf?device_sn=${encodeURIComponent(sn)}&on_date=${d}`,
  periodicPdfUrl: (sn: string | null, s: string, e: string) =>
    `/api/reports/periodic.pdf?start=${s}&end=${e}` + (sn ? `&device_sn=${encodeURIComponent(sn)}` : ""),
  excelUrl: (sn: string | null, s: string, e: string) =>
    `/api/reports/export.xlsx?start=${s}&end=${e}` + (sn ? `&device_sn=${encodeURIComponent(sn)}` : ""),
};
