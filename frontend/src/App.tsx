import { useCallback, useEffect, useMemo, useState } from "react";
import { api, getToken, clearToken } from "./api";
import type { AuthData, Device, Kpi, TimeSeries, UploadResult, WeatherCompare } from "./types";
import { KpiCards } from "./components/KpiCards";
import { TimeSeriesChart } from "./components/TimeSeriesChart";
import { WeatherCompareChart } from "./components/WeatherCompareChart";
import { HeatGuidelines } from "./components/HeatGuidelines";
import { UploadPanel } from "./components/UploadPanel";
import { DeviceRegister } from "./components/DeviceRegister";
import { ReportPanel } from "./components/ReportPanel";
import { AuthScreen } from "./components/AuthScreen";
import { Stepper, type Step } from "./components/Stepper";
import { SiteFooter } from "./components/SiteFooter";
import { AdminPage } from "./components/AdminPage";
import { Alert, Button, Group, Paper, Select, Text } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";

export default function App() {
  const [auth, setAuth] = useState<AuthData | null>(null);
  const [booting, setBooting] = useState(true);
  const [step, setStep] = useState<Step>(2);
  const [adminOpen, setAdminOpen] = useState(false);

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
  // 시계열 차트는 리포트 기간(rangeStart~rangeEnd)으로 조회 — N일 추이
  const periodStart = useMemo(() => `${rangeStart}T00:00:00`, [rangeStart]);
  const periodEnd = useMemo(() => `${rangeEnd}T23:59:59`, [rangeEnd]);

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
    setStep(2); setAdminOpen(false);
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
      notifications.show({
        color: "teal",
        title: "업로드 완료",
        autoClose: 6000,
        message:
          `${r.affected_devices.join(", ")} · ${total.toLocaleString()}건 반영 · ` +
          `${r.min_date ?? ""}~${r.max_date ?? ""} 데이터를 표시합니다.`,
      });
      setStep(4);  // 대시보드로 자동 진행
    }
  }, [loadDevices, loadRange]);

  // 데이터 초기화 직후: 대시보드 상태·날짜 목록 비우고 업로드 단계 유지
  const handleReset = useCallback(async () => {
    setKpi(null); setTs(null); setCmp(null);
    setAvailableDates([]);
    await loadRange(deviceSn);
  }, [loadRange, deviceSn]);

  // 대시보드 데이터 로드
  useEffect(() => {
    if (!auth || step !== 4) return;
    setLoadErr(null);
    api.kpi(deviceSn, dayStart, dayEnd).then(setKpi).catch((e) => setLoadErr(String(e)));
    if (deviceSn) {
      // 시계열 = 리포트 기간(N일) · 외부비교 = 기준일자(단일일, 외부 시간자료가 일자 기준)
      api.timeseries(deviceSn, periodStart, periodEnd, interval).then(setTs).catch(() => setTs(null));
      api.weatherCompare(deviceSn, dayStart, dayEnd, 30).then(setCmp).catch(() => setCmp(null));
    } else {
      setTs(null); setCmp(null);
    }
  }, [auth, step, deviceSn, dayStart, dayEnd, periodStart, periodEnd, interval, date]);

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
                <h1 className="truncate text-[15px] font-bold tracking-tight text-slate-900">체감온도계 데이터 분석 프로그램</h1>
                <p className="truncate text-xs text-slate-400">{auth.company_name}{auth.email ? ` · ${auth.email}` : ""}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {auth.is_admin && (
                <Button size="xs" variant={adminOpen ? "filled" : "default"} onClick={() => setAdminOpen((v) => !v)}>
                  {adminOpen ? "← 일반 화면" : "관리자"}
                </Button>
              )}
              <Button size="xs" variant="default" onClick={logout}>로그아웃</Button>
            </div>
          </div>
        </div>
        {/* 단계 표시 */}
        {!adminOpen && (
          <div className="border-t border-slate-100 bg-white/60">
            <div className="mx-auto max-w-7xl px-5 py-2">
              <Stepper current={step} onJump={setStep} canDashboard={canDashboard} />
            </div>
          </div>
        )}
      </header>

      {adminOpen && <AdminPage onClose={() => setAdminOpen(false)} />}

      {/* 대시보드 컨트롤 바 (대시보드 단계에서만) */}
      {!adminOpen && step === 4 && (
        <div className="border-b border-slate-200/60 bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-end gap-3 px-4 py-3">
            <Select
              label="기기 선택"
              size="sm"
              w={240}
              allowDeselect={false}
              value={deviceSn ?? ""}
              onChange={(v) => { const nv = v || null; setDeviceSn(nv); loadRange(nv); }}
              data={[
                { value: "", label: "(전체 사업장)" },
                ...devices.map((d) => ({
                  value: d.device_sn,
                  label: `${d.device_sn}${d.location_name ? ` · ${d.location_name}` : (d.company_name ? ` · ${d.company_name}` : "")}`,
                })),
              ]}
            />
            {availableDates.length > 0 ? (
              <Select
                label="기준 일자 (데이터 보유일)"
                size="sm"
                w={180}
                allowDeselect={false}
                value={date}
                onChange={(v) => v && setDate(v)}
                data={availableDates}
              />
            ) : (
              <DatePickerInput
                label="기준 일자"
                size="sm"
                w={180}
                valueFormat="YYYY-MM-DD"
                value={date}
                onChange={(v) => v && setDate(v)}
              />
            )}
            <Select
              label="다운샘플링"
              size="sm"
              w={140}
              allowDeselect={false}
              value={String(interval)}
              onChange={(v) => v && setIntervalMin(Number(v))}
              data={[
                { value: "1", label: "1분(원본)" },
                { value: "10", label: "10분 평균" },
                { value: "30", label: "30분 평균" },
              ]}
            />
            <div className="mx-1 h-9 w-px self-center bg-slate-200" />
            <DatePickerInput
              label="리포트 기간(시작)"
              size="sm"
              w={160}
              valueFormat="YYYY-MM-DD"
              value={rangeStart}
              onChange={(v) => v && setRangeStart(v)}
            />
            <DatePickerInput
              label="리포트 기간(종료)"
              size="sm"
              w={160}
              valueFormat="YYYY-MM-DD"
              value={rangeEnd}
              onChange={(v) => v && setRangeEnd(v)}
            />
            {selected && (
              <div className="ml-auto text-right text-xs text-slate-400">
                <div className="font-semibold text-slate-600">{selected.device_sn}</div>
                <div>{selected.address}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {!adminOpen && (
      <main className="mx-auto max-w-7xl space-y-5 px-5 py-7">
        {loadErr && (
          <Alert color="red" variant="light" title="불러오기 오류">{loadErr}</Alert>
        )}

        {step === 2 && (
          <>
            <Paper withBorder radius="lg" p="md" shadow="xs">
              <Text size="sm" c="dimmed">
                <b style={{ color: "#0f172a" }}>STEP 2 · 사업장·기기 등록</b> — 측정 데이터를 등록하기 전에 기기를 먼저 등록합니다.
                기기명은 관리자가 알아보기 쉬운 이름으로 자유롭게 입력하고, 여러 대를 각각 등록할 수 있습니다.
              </Text>
            </Paper>
            <DeviceRegister devices={devices} defaultCompany={auth.company_name} onChange={loadDevices} />
            <Button fullWidth size="md" onClick={() => setStep(3)}>
              {canDashboard ? "다음: 데이터 업로드 →" : "기기 없이 업로드로 진행 →"}
            </Button>
          </>
        )}

        {step === 3 && (
          <>
            <Paper withBorder radius="lg" p="md" shadow="xs">
              <Text size="sm" c="dimmed">
                <b style={{ color: "#0f172a" }}>STEP 3 · 측정 데이터 업로드</b> — 위에서 선택한 기기로 측정 데이터가 연결되며, 완료 시 대시보드로 자동 전환됩니다.
              </Text>
            </Paper>
            <UploadPanel devices={devices} onUploaded={handleUploaded} onReset={handleReset} />

            <Group grow>
              <Button variant="default" size="md" onClick={() => setStep(2)}>← 기기 등록으로</Button>
              {canDashboard && (
                <Button size="md" onClick={() => setStep(4)}>대시보드로 이동 →</Button>
              )}
            </Group>
          </>
        )}

        {step === 4 && (
          <>
            <KpiCards kpi={kpi} />
            <TimeSeriesChart ts={ts} kpi={kpi} />
            <WeatherCompareChart cmp={cmp} />
            <HeatGuidelines kpi={kpi} />
            <ReportPanel deviceSn={deviceSn} date={date} rangeStart={rangeStart} rangeEnd={rangeEnd} />
          </>
        )}
      </main>
      )}

      <SiteFooter withBanner />
    </div>
  );
}
