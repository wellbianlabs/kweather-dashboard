import { useCallback, useEffect, useMemo, useState } from "react";
import { api, getToken, clearToken } from "./api";
import type { AuthData, Device, Kpi, TimeSeries, UploadResult, WeatherCompare } from "./types";
import { KpiCards } from "./components/KpiCards";
import { TimeSeriesChart } from "./components/TimeSeriesChart";
import { WeatherCompareChart } from "./components/WeatherCompareChart";
import { HeatGuidelines } from "./components/HeatGuidelines";
import { IconCheck } from "./components/Icons";
import { UploadPanel } from "./components/UploadPanel";
import { DeviceRegister } from "./components/DeviceRegister";
import { ReportPanel } from "./components/ReportPanel";
import { AuthScreen } from "./components/AuthScreen";
import { Stepper, type Step } from "./components/Stepper";

export default function App() {
  const [auth, setAuth] = useState<AuthData | null>(null);
  const [booting, setBooting] = useState(true);
  const [step, setStep] = useState<Step>(2);

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
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  const dayStart = useMemo(() => `${date}T00:00:00`, [date]);
  const dayEnd = useMemo(() => `${date}T23:59:59`, [date]);

  // 부팅: 저장된 토큰이 있으면 검증
  useEffect(() => {
    if (!getToken()) { setBooting(false); return; }
    api.me()
      .then((a) => { setAuth(a); setStep(a.has_data ? 4 : 2); })
      .catch(() => clearToken())
      .finally(() => setBooting(false));
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
      // 리포트 기간 = 업로드 데이터 전체 바운더리(가장 이른 날 ~ 최근 날)
      if (r.min_date) setRangeStart(r.min_date);
      if (r.max_date) setRangeEnd(r.max_date);
      // 대시보드 기준 일자 = 가장 최근 날
      if (r.max_date) setDate(r.max_date);
    } catch { /* 데이터 없으면 기본값 유지 */ }
  }, []);

  // 인증 직후: 데이터 있으면 대시보드(4), 없으면 기기 등록(2)부터
  const onAuthed = useCallback((a: AuthData) => {
    setAuth(a);
    setStep(a.has_data ? 4 : 2);
  }, []);

  function logout() {
    clearToken();
    setAuth(null);
    setDevices([]); setDeviceSn(null); setKpi(null); setTs(null); setCmp(null);
    setStep(2);
  }

  // 로그인 후 기기 목록 로드 + 데이터 최근 날짜로 기본 설정
  useEffect(() => {
    if (!auth) return;
    loadDevices()
      .then((ds) => loadRange(ds[0]?.device_sn ?? null))
      .catch((e) => setLoadErr(String(e)));
  }, [auth, loadDevices, loadRange]);

  // 업로드 직후: 업로드한 기기/일자로 대시보드 자동 이동
  const handleUploaded = useCallback(async (results: UploadResult[]) => {
    await loadDevices();
    const r = results.find((x) => x.affected_devices.length > 0);
    if (r) {
      const sn = r.affected_devices[0];
      setDeviceSn(sn);
      await loadRange(sn);  // 전체 바운더리·날짜목록·기준일자 갱신(업로드 데이터 기준)
      const total = results.reduce((s, x) => s + x.rows_inserted + x.rows_updated, 0);
      setUploadNotice(
        `업로드 완료: ${r.affected_devices.join(", ")} · ${total.toLocaleString()}건 반영 · ` +
        `${r.min_date ?? ""}~${r.max_date ?? ""} 데이터를 표시합니다.`
      );
      setStep(4);  // 대시보드로 자동 진행
    }
  }, [loadDevices, loadRange]);

  // 대시보드 데이터 로드
  useEffect(() => {
    if (!auth || step !== 4) return;
    setLoadErr(null);
    api.kpi(deviceSn, dayStart, dayEnd).then(setKpi).catch((e) => setLoadErr(String(e)));
    if (deviceSn) {
      api.timeseries(deviceSn, dayStart, dayEnd, interval).then(setTs).catch(() => setTs(null));
      api.weatherCompare(deviceSn, dayStart, dayEnd, 30).then(setCmp).catch(() => setCmp(null));
    } else {
      setTs(null); setCmp(null);
    }
  }, [auth, step, deviceSn, dayStart, dayEnd, interval, date]);

  if (booting) {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">불러오는 중...</div>;
  }
  if (!auth) return <AuthScreen onAuthed={onAuthed} />;

  const selected = devices.find((d) => d.device_sn === deviceSn);
  const canDashboard = devices.length > 0;

  return (
    <div className="min-h-screen text-slate-800">
      {/* 헤더 — 화이트톤 */}
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3.5">
              <img src="/kweather-logo.png" alt="KWEATHER" className="h-6 shrink-0 sm:h-7" />
              <div className="hidden h-8 w-px bg-slate-200 sm:block" />
              <div className="min-w-0">
                <h1 className="truncate text-[15px] font-bold tracking-tight text-slate-900">체감온도계 안전보건 대시보드</h1>
                <p className="truncate text-xs text-slate-400">{auth.company_name}{auth.email ? ` · ${auth.email}` : ""}</p>
              </div>
            </div>
            <button onClick={logout} className="btn-ghost shrink-0 !py-2 text-sm">로그아웃</button>
          </div>
        </div>
        {/* 단계 표시 */}
        <div className="border-t border-slate-100 bg-white/60">
          <div className="mx-auto max-w-7xl px-5 py-2">
            <Stepper current={step} onJump={setStep} canDashboard={canDashboard} />
          </div>
        </div>
      </header>

      {/* 대시보드 컨트롤 바 (대시보드 단계에서만) */}
      {step === 4 && (
        <div className="border-b border-slate-200/60 bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-end gap-3 px-4 py-3">
            <Field label="기기 선택">
              <select className="select"
                value={deviceSn ?? ""}
                onChange={(e) => { const v = e.target.value || null; setDeviceSn(v); loadRange(v); }}>
                <option value="">(전체 사업장)</option>
                {devices.map((d) => (
                  <option key={d.device_sn} value={d.device_sn}>
                    {d.company_name ? `${d.company_name} / ${d.location_name ?? ""}` : d.device_sn}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="기준 일자 (데이터 보유일)">
              {availableDates.length > 0 ? (
                <select className="select"
                  value={date} onChange={(e) => setDate(e.target.value)}>
                  {availableDates.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              ) : (
                <input type="date" className="select"
                  value={date} onChange={(e) => setDate(e.target.value)} />
              )}
            </Field>
            <Field label="다운샘플링">
              <select className="select"
                value={interval} onChange={(e) => setIntervalMin(Number(e.target.value))}>
                <option value={1}>1분(원본)</option>
                <option value={10}>10분 평균</option>
                <option value={30}>30분 평균</option>
              </select>
            </Field>
            <div className="mx-2 h-8 w-px bg-slate-200" />
            <Field label="리포트 기간(시작)">
              <input type="date" className="select"
                value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
            </Field>
            <Field label="리포트 기간(종료)">
              <input type="date" className="select"
                value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
            </Field>
            {selected && (
              <div className="ml-auto text-right text-xs text-slate-400">
                <div className="font-mono">{selected.device_sn}</div>
                <div>{selected.address}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl space-y-5 px-5 py-7">
        {loadErr && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{loadErr}</div>
        )}

        {step === 2 && (
          <>
            <div className="rounded-2xl border border-slate-200/70 bg-white px-5 py-4 text-sm text-slate-600 shadow-card">
              <b className="text-slate-900">STEP 2 · 사업장·기기 등록</b> — 측정 데이터를 등록하기 전에 기기 정보를 먼저 등록합니다.
              동일 법인이라도 사업장(장소)·기기 단위로 각각 등록할 수 있습니다.
            </div>
            <DeviceRegister devices={devices} defaultCompany={auth.company_name} onChange={loadDevices} />
            <button onClick={() => setStep(3)}
                    className="btn-primary w-full !py-3">
              {canDashboard ? "다음: 데이터 업로드 →" : "기기 없이 업로드로 진행 →"}
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <div className="rounded-2xl border border-slate-200/70 bg-white px-5 py-4 text-sm text-slate-600 shadow-card">
              <b className="text-slate-900">STEP 3 · 측정 데이터 업로드</b> — 케이웨더 체감온도계 CSV(탭 구분) 파일을 업로드합니다.
              파일의 기기 SN이 등록된 기기와 일치하면 해당 사업장으로 데이터가 연결되며, 완료 시 대시보드로 자동 전환됩니다.
            </div>
            <UploadPanel onUploaded={handleUploaded} />

            <div className="flex gap-2">
              <button onClick={() => setStep(2)}
                      className="btn-ghost flex-1 !py-3">
                ← 기기 등록으로
              </button>
              {canDashboard && (
                <button onClick={() => setStep(4)}
                        className="btn-primary flex-1 !py-3">
                  대시보드로 이동 →
                </button>
              )}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            {uploadNotice && (
              <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <span className="inline-flex items-center gap-2"><IconCheck className="h-4 w-4 text-emerald-600" />{uploadNotice}</span>
                <button onClick={() => setUploadNotice(null)} className="text-emerald-600 hover:text-emerald-800">✕</button>
              </div>
            )}
            <KpiCards kpi={kpi} />
            <TimeSeriesChart ts={ts} kpi={kpi} />
            <WeatherCompareChart cmp={cmp} />
            <HeatGuidelines kpi={kpi} />
            <ReportPanel deviceSn={deviceSn} date={date} rangeStart={rangeStart} rangeEnd={rangeEnd} />
          </>
        )}
      </main>

      <footer className="py-10 text-center text-xs leading-relaxed text-slate-400">
        <img src="/kweather-logo.png" alt="KWEATHER" className="mx-auto mb-2.5 h-4 opacity-50" />
        체감온도계 안전보건 대시보드 · 위험단계 기준(체감온도): 관심 31℃ / 주의 33℃ / 경고 35℃ / 위험 38℃
      </footer>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}
