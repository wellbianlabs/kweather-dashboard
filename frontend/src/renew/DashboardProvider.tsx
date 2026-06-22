// 리뉴얼 본배선 — 대시보드 전역 데이터 컨텍스트.
// App.tsx 의 데이터 로딩 로직(인증·기기·기간·KPI/시계열/외부비교)을 셸·페이지가 공유하도록 승격.
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";
import { api, getToken, clearToken } from "../api";
import type { AuthData, Device, HeatLevel, Kpi, TimeSeries, UploadResult, WeatherCompare } from "../types";
import { notifications } from "@mantine/notifications";

/** 사업장(기기)별 현재 위험 — DataTable·위험지도 공용. */
export interface SiteRisk {
  device_sn: string;
  company_name: string | null;
  location_name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  feels: number | null;       // 기준일 최고 체감온도
  level: HeatLevel | null;     // 기준일 위험단계(kpi.current_level)
}

interface DashboardCtx {
  booting: boolean;
  auth: AuthData | null;
  onAuthed: (a: AuthData) => void;
  logout: () => void;

  devices: Device[];
  deviceSn: string | null;
  setDeviceSn: (sn: string | null) => void;
  selected: Device | undefined;

  date: string;
  setDate: (d: string) => void;
  rangeStart: string;
  setRangeStart: (d: string) => void;
  rangeEnd: string;
  setRangeEnd: (d: string) => void;
  availableDates: string[];
  interval: number;
  setIntervalMin: (n: number) => void;

  kpi: Kpi | null;
  ts: TimeSeries | null;
  cmp: WeatherCompare | null;
  sites: SiteRisk[];
  loadErr: string | null;

  loadDevices: () => Promise<Device[]>;
  loadRange: (sn: string | null) => Promise<void>;
  handleUploaded: (results: UploadResult[]) => Promise<void>;
  handleReset: () => Promise<void>;

  // 공통 업로더 제어 + 최근 업로드 기록(localStorage)
  uploadOpen: boolean;
  uploadTarget: string | null;
  openUpload: (sn?: string | null) => void;
  closeUpload: () => void;
  lastUpload: Record<string, string>;

  // 최근 7일 일별 체감 통계(실측) — 주간 위젯용(최고·평균 체감 + 최고 기온)
  weekly: { date: string; max_feels: number | null; avg_feels: number | null; max_temp: number | null }[];
}

const Ctx = createContext<DashboardCtx | null>(null);

export function useDashboard(): DashboardCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDashboard must be used within DashboardProvider");
  return v;
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthData | null>(null);
  const [booting, setBooting] = useState(true);

  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceSn, setDeviceSn] = useState<string | null>(null);
  const [date, setDate] = useState("2026-06-03");
  const [rangeStart, setRangeStart] = useState("2026-06-01");
  const [rangeEnd, setRangeEnd] = useState("2026-06-03");
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [interval, setIntervalMin] = useState(10);

  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [ts, setTs] = useState<TimeSeries | null>(null);
  const [cmp, setCmp] = useState<WeatherCompare | null>(null);
  const [sites, setSites] = useState<SiteRisk[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // 공통 업로더 모달 제어 + 기기별 최근 업로드 일시
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);
  const [lastUpload, setLastUpload] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("kw_last_upload") || "{}"); } catch { return {}; }
  });
  const [weekly, setWeekly] = useState<{ date: string; max_feels: number | null; avg_feels: number | null; max_temp: number | null }[]>([]);
  const openUpload = useCallback((sn?: string | null) => {
    setUploadTarget(sn ?? null);
    setUploadOpen(true);
  }, []);
  const closeUpload = useCallback(() => setUploadOpen(false), []);

  const dayStart = useMemo(() => `${date}T00:00:00`, [date]);
  const dayEnd = useMemo(() => `${date}T23:59:59`, [date]);
  // 데이터 분석(시계열)·외부비교 모두 분석 일자(단일일) 기준. 기간 분석은 별도 '기간 통계 보고서'.

  // 부팅: 저장된 토큰이 있으면 검증
  useEffect(() => {
    if (!getToken()) { setBooting(false); return; }
    api.me().then(setAuth).catch(() => clearToken()).finally(() => setBooting(false));
  }, []);

  const loadDevices = useCallback(async () => {
    const ds = await api.listDevices();
    setDevices(ds);
    setDeviceSn((cur) => cur ?? (ds[0]?.device_sn ?? null));
    return ds;
  }, []);

  // 데이터가 있는 최근 날짜로 기본 설정 (해당 기기 또는 전체)
  const loadRange = useCallback(async (sn: string | null) => {
    try {
      const r = await api.dataRange(sn);
      setAvailableDates(r.dates || []);
      if (r.min_date) setRangeStart(r.min_date);
      if (r.max_date) setRangeEnd(r.max_date);
      if (r.max_date) setDate(r.max_date);
    } catch { /* 데이터 없으면 기본값 유지 */ }
  }, []);

  const onAuthed = useCallback((a: AuthData) => setAuth(a), []);

  const logout = useCallback(() => {
    clearToken();
    setAuth(null);
    setDevices([]); setDeviceSn(null); setKpi(null); setTs(null); setCmp(null);
    setAvailableDates([]);
  }, []);

  // 로그인 후 기기 목록 + 데이터 최근 날짜로 기본 설정
  useEffect(() => {
    if (!auth) return;
    loadDevices()
      .then((ds) => loadRange(ds[0]?.device_sn ?? null))
      .catch((e) => setLoadErr(String(e)));
  }, [auth, loadDevices, loadRange]);

  // 업로드 직후: 업로드한 기기/일자로 갱신
  const handleUploaded = useCallback(async (results: UploadResult[]) => {
    await loadDevices();
    const affected = Array.from(new Set(results.flatMap((x) => x.affected_devices)));
    if (affected.length) {
      // 기기별 최근 업로드 일시 기록(영속)
      const stamp = new Date().toISOString();
      setLastUpload((prev) => {
        const next = { ...prev };
        affected.forEach((sn) => { next[sn] = stamp; });
        try { localStorage.setItem("kw_last_upload", JSON.stringify(next)); } catch { /* noop */ }
        return next;
      });
      const sn = affected[0];
      setDeviceSn(sn);
      await loadRange(sn);
      const total = results.reduce((s, x) => s + x.rows_inserted + x.rows_updated, 0);
      const dates = results.flatMap((x) => [x.min_date, x.max_date]).filter(Boolean) as string[];
      const minD = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : "";
      const maxD = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : "";
      const span = minD && maxD && maxD !== minD ? `${minD}~${maxD}` : (minD || maxD);
      notifications.show({
        color: "teal", title: "업로드 완료", autoClose: 6000,
        message: `${affected.join(", ")} · ${total.toLocaleString()}건 반영` + (span ? ` · ${span} 데이터를 표시합니다.` : ""),
      });
    }
  }, [loadDevices, loadRange]);

  // 데이터 초기화 직후
  const handleReset = useCallback(async () => {
    setKpi(null); setTs(null); setCmp(null); setAvailableDates([]);
    await loadRange(deviceSn);
  }, [loadRange, deviceSn]);

  // 대시보드 데이터 로드 (인증 후 상시 — step 게이트 제거)
  // 레이스 가드: 일자/기기 변경 시 이전 요청의 늦은 응답이 최신 상태를 덮어쓰지 않도록
  // live 플래그로 무효화한다(시계열은 6/15인데 기상청 비교만 6/14가 남아 '2일'로 그려지던 버그 방지).
  useEffect(() => {
    if (!auth) return;
    setLoadErr(null);
    let live = true;
    api.kpi(deviceSn, dayStart, dayEnd).then((r) => { if (live) setKpi(r); }).catch((e) => { if (live) setLoadErr(String(e)); });
    if (deviceSn) {
      api.timeseries(deviceSn, dayStart, dayEnd, interval).then((r) => { if (live) setTs(r); }).catch(() => { if (live) setTs(null); });
      api.weatherCompare(deviceSn, dayStart, dayEnd, interval).then((r) => { if (live) setCmp(r); }).catch(() => { if (live) setCmp(null); });
    } else {
      setTs(null); setCmp(null);
    }
    return () => { live = false; };
  }, [auth, deviceSn, dayStart, dayEnd, interval]);

  // 사업장(기기)별 현재 위험 — 기준일 기준 per-device kpi 병렬 조회(DataTable·위험지도 공용)
  useEffect(() => {
    if (!auth || !devices.length) { setSites([]); return; }
    let on = true;
    Promise.all(
      devices.map(async (d): Promise<SiteRisk> => {
        const base = {
          device_sn: d.device_sn, company_name: d.company_name, location_name: d.location_name,
          address: d.address, latitude: d.latitude, longitude: d.longitude,
        };
        try {
          const k = await api.kpi(d.device_sn, dayStart, dayEnd);
          return { ...base, feels: k.max_feels_like, level: k.current_level };
        } catch {
          return { ...base, feels: null, level: null };
        }
      }),
    ).then((rows) => { if (on) setSites(rows); });
    return () => { on = false; };
  }, [auth, devices, dayStart, dayEnd]);

  // 최근 7일 일 최고 체감(실측) — 선택 기기 기준(데이터 있는 일자 우선)
  useEffect(() => {
    if (!auth || !deviceSn) { setWeekly([]); return; }
    const days = (availableDates.length ? availableDates : [date]).slice(-7);
    let on = true;
    Promise.all(days.map(async (d) => {
      try {
        const k = await api.kpi(deviceSn, `${d}T00:00:00`, `${d}T23:59:59`);
        return { date: d, max_feels: k.max_feels_like, avg_feels: k.avg_feels_like, max_temp: k.max_temperature };
      } catch { return { date: d, max_feels: null, avg_feels: null, max_temp: null }; }
    })).then((rows) => { if (on) setWeekly(rows); });
    return () => { on = false; };
  }, [auth, deviceSn, availableDates, date]);

  const selected = devices.find((d) => d.device_sn === deviceSn);

  const value: DashboardCtx = {
    booting, auth, onAuthed, logout,
    devices, deviceSn, setDeviceSn, selected,
    date, setDate, rangeStart, setRangeStart, rangeEnd, setRangeEnd, availableDates, interval, setIntervalMin,
    kpi, ts, cmp, sites, loadErr,
    loadDevices, loadRange, handleUploaded, handleReset,
    uploadOpen, uploadTarget, openUpload, closeUpload, lastUpload, weekly,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
