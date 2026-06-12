import type {
  Device,
  Kpi,
  TimeSeries,
  WeatherCompare,
  UploadResult,
  DailyReport,
  AuthData,
} from "./types";

// 배포 시 백엔드 URL(VITE_API_BASE). 로컬/단일오리진은 빈 값(개발 시 Vite 프록시가 8000으로 전달).
const BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") || "";
export const TOKEN_KEY = "kw_api_key";

// 모든 요청 경로에 BASE 접두
const u = (path: string) => BASE + path;

// 토큰은 매 요청마다 localStorage 에서 최신값을 읽는다(로그인/로그아웃 즉시 반영).
export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || "";
}
export function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function headers(extra: Record<string, string> = {}) {
  return { "X-API-Key": getToken(), ...extra };
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(u(url), {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    let detail = await r.text();
    try { detail = JSON.parse(detail).detail ?? detail; } catch {}
    throw new Error(detail);
  }
  return r.json();
}

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(u(url), { headers: headers() });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

export const api = {
  // ---- Auth ----
  signup: (email: string, password: string, company_name: string) =>
    postJSON<AuthData>("/api/auth/signup", { email, password, company_name }),
  login: (email: string, password: string) =>
    postJSON<AuthData>("/api/auth/login", { email, password }),
  me: () => getJSON<AuthData>("/api/auth/me"),

  health: () => getJSON<any>("/api/health"),

  listDevices: () => getJSON<Device[]>("/api/devices"),

  createDevice: (payload: Partial<Device> & { device_sn: string }) =>
    postJSON<Device>("/api/devices", payload),

  deleteDevice: async (sn: string): Promise<void> => {
    const r = await fetch(u(`/api/devices/${encodeURIComponent(sn)}`), {
      method: "DELETE",
      headers: headers(),
    });
    if (!r.ok && r.status !== 204) throw new Error(await r.text());
  },

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

  // 케이웨더 IoT 단말기 실시간 측정값 동기화
  kwStatus: () => getJSON<{ configured: boolean; base_url: string }>("/api/kweather/status"),
  syncLive: () => postJSON<{
    fetched: number; ingested: number; devices: string[]; new_devices: string[];
    errors: string[]; readings: { sn: string; kind: string; temp: number; humi: number; feels: number; at: string }[];
  }>("/api/kweather/sync", {}),

  geocode: (address: string) =>
    getJSON<{ lat: number; lon: number; matched: string; provider: string }>(
      `/api/geocode?address=${encodeURIComponent(address)}`,
    ),

  dataRange: (deviceSn: string | null) => {
    const p = new URLSearchParams();
    if (deviceSn) p.set("device_sn", deviceSn);
    return getJSON<{ min_date: string | null; max_date: string | null; dates: string[] }>(
      `/api/dashboard/data-range?${p}`,
    );
  },

  timeseries: (deviceSn: string, start: string, end: string, interval: number) => {
    const p = new URLSearchParams({ device_sn: deviceSn, start, end, interval: String(interval) });
    return getJSON<TimeSeries>(`/api/dashboard/timeseries?${p}`);
  },

  weatherCompare: (deviceSn: string, start: string, end: string, interval: number) => {
    const p = new URLSearchParams({ device_sn: deviceSn, start, end, interval: String(interval) });
    return getJSON<WeatherCompare>(`/api/weather/compare?${p}`);
  },


  dailyReport: (deviceSn: string, onDate: string) => {
    const p = new URLSearchParams({ device_sn: deviceSn, on_date: onDate });
    return getJSON<DailyReport>(`/api/reports/daily?${p}`);
  },

  // 대량 업로드: 서버리스 요청 한도(4.5MB)·시간 제한(60s)을 피하려 파일을 배치로 나눠
  // 동시성 제한으로 업로드한다. 진행률 콜백(onProgress)으로 UI 갱신.
  upload: async (
    files: FileList | File[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<UploadResult[]> => {
    const arr = Array.from(files);
    const MAX_BYTES = 3.5 * 1024 * 1024; // 배치당 누적 크기 한도(여유분 포함)
    const MAX_FILES = 20;                 // 배치당 파일 수 한도(시간 제한 여유)

    const batches: File[][] = [];
    let cur: File[] = [], bytes = 0;
    for (const f of arr) {
      if (cur.length && (bytes + f.size > MAX_BYTES || cur.length >= MAX_FILES)) {
        batches.push(cur); cur = []; bytes = 0;
      }
      cur.push(f); bytes += f.size;
    }
    if (cur.length) batches.push(cur);

    const results: UploadResult[] = [];
    let done = 0;
    let next = 0;
    const CONCURRENCY = Math.min(3, batches.length);

    async function runOne(batch: File[]): Promise<UploadResult[]> {
      const fd = new FormData();
      batch.forEach((f) => fd.append("files", f));
      const r = await fetch(u("/api/upload"), { method: "POST", headers: headers(), body: fd });
      if (!r.ok) {
        const t = (await r.text()).slice(0, 120);
        // 배치 실패를 합성 결과로 표면화(전체 중단 대신 계속 진행)
        return batch.map((f) => ({
          filename: f.name, rows_parsed: 0, rows_inserted: 0, rows_updated: 0, rows_skipped: 0,
          new_devices: [], affected_devices: [], min_date: null, max_date: null,
          encoding: "?", errors: [`업로드 실패 (HTTP ${r.status}) ${t}`],
        }));
      }
      return r.json();
    }

    async function worker() {
      while (next < batches.length) {
        const i = next++;
        const res = await runOne(batches[i]);
        results.push(...res);
        done += batches[i].length;
        onProgress?.(done, arr.length);
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    return results;
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
