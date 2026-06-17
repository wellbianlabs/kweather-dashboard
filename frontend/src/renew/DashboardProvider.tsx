// 리뉴얼 본배선 — 대시보드 전역 데이터 컨텍스트.
// App.tsx 의 데이터 로딩 로직(인증·기기·기간·KPI/시계열/외부비교)을 셸·페이지가 공유하도록 승격.
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";
import { api, getToken, clearToken } from "../api";
import type { AuthData, Device, Kpi, TimeSeries, UploadResult, WeatherCompare } from "../types";
import { notifications } from "@mantine/notifications";

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
  loadErr: string | null;

  loadDevices: () => Promise<Device[]>;
  loadRange: (sn: string | null) => Promise<void>;
  handleUploaded: (results: UploadResult[]) => Promise<void>;
  handleReset: () => Promise<void>;
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
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const dayStart = useMemo(() => `${date}T00:00:00`, [date]);
  const dayEnd = useMemo(() => `${date}T23:59:59`, [date]);
  // 시계열 = 리포트 기간(rangeStart~rangeEnd) N일 추이 · 외부비교 = 기준일자(단일일)
  const periodStart = useMemo(() => `${rangeStart}T00:00:00`, [rangeStart]);
  const periodEnd = useMemo(() => `${rangeEnd}T23:59:59`, [rangeEnd]);

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
  useEffect(() => {
    if (!auth) return;
    setLoadErr(null);
    api.kpi(deviceSn, dayStart, dayEnd).then(setKpi).catch((e) => setLoadErr(String(e)));
    if (deviceSn) {
      api.timeseries(deviceSn, periodStart, periodEnd, interval).then(setTs).catch(() => setTs(null));
      api.weatherCompare(deviceSn, dayStart, dayEnd, 30).then(setCmp).catch(() => setCmp(null));
    } else {
      setTs(null); setCmp(null);
    }
  }, [auth, deviceSn, dayStart, dayEnd, periodStart, periodEnd, interval]);

  const selected = devices.find((d) => d.device_sn === deviceSn);

  const value: DashboardCtx = {
    booting, auth, onAuthed, logout,
    devices, deviceSn, setDeviceSn, selected,
    date, setDate, rangeStart, setRangeStart, rangeEnd, setRangeEnd, availableDates, interval, setIntervalMin,
    kpi, ts, cmp, loadErr,
    loadDevices, loadRange, handleUploaded, handleReset,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
