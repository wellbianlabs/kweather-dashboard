import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { Device, Kpi, TimeSeries, UploadResult, WeatherCompare } from "./types";
import { KpiCards } from "./components/KpiCards";
import { TimeSeriesChart } from "./components/TimeSeriesChart";
import { WeatherCompareChart } from "./components/WeatherCompareChart";
import { UploadPanel } from "./components/UploadPanel";
import { DeviceManager } from "./components/DeviceManager";
import { ReportPanel } from "./components/ReportPanel";

type Tab = "dashboard" | "manage";

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceSn, setDeviceSn] = useState<string | null>(null);
  const [date, setDate] = useState("2026-06-03");
  const [rangeStart, setRangeStart] = useState("2026-06-01");
  const [rangeEnd, setRangeEnd] = useState("2026-06-03");
  const [interval, setIntervalMin] = useState(10);

  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [ts, setTs] = useState<TimeSeries | null>(null);
  const [cmp, setCmp] = useState<WeatherCompare | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  const dayStart = useMemo(() => `${date}T00:00:00`, [date]);
  const dayEnd = useMemo(() => `${date}T23:59:59`, [date]);

  const loadDevices = useCallback(async () => {
    const ds = await api.listDevices();
    setDevices(ds);
    setDeviceSn((cur) => cur ?? (ds[0]?.device_sn ?? null));
  }, []);

  useEffect(() => { loadDevices().catch((e) => setLoadErr(String(e))); }, [loadDevices]);

  // 업로드 직후: 업로드한 기기/일자로 대시보드 자동 이동 (핵심 기능)
  const handleUploaded = useCallback(async (results: UploadResult[]) => {
    await loadDevices();
    const r = results.find((x) => x.affected_devices.length > 0);
    if (r) {
      setDeviceSn(r.affected_devices[0]);
      if (r.min_date) setRangeStart(r.min_date);
      if (r.max_date) { setRangeEnd(r.max_date); setDate(r.max_date); }
      const total = results.reduce((s, x) => s + x.rows_inserted + x.rows_updated, 0);
      setUploadNotice(
        `업로드 완료: ${r.affected_devices.join(", ")} · ${total.toLocaleString()}건 반영 · ` +
        `${r.min_date ?? ""}~${r.max_date ?? ""} 데이터를 표시합니다.`
      );
    }
    setTab("dashboard");
  }, [loadDevices]);

  // 대시보드 데이터 로드
  useEffect(() => {
    setLoadErr(null);
    api.kpi(deviceSn, dayStart, dayEnd).then(setKpi).catch((e) => setLoadErr(String(e)));
    if (deviceSn) {
      api.timeseries(deviceSn, dayStart, dayEnd, interval).then(setTs).catch(() => setTs(null));
      api.weatherCompare(deviceSn, dayStart, dayEnd, 30).then(setCmp).catch(() => setCmp(null));
    } else {
      setTs(null); setCmp(null);
    }
  }, [deviceSn, dayStart, dayEnd, interval, date]);

  const selected = devices.find((d) => d.device_sn === deviceSn);

  return (
    <div className="min-h-screen text-slate-800">
      {/* 헤더 */}
      <header className="bg-slate-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold">🌡️ 케이웨더 체감온도계 연동 대시보드</h1>
              <p className="text-xs text-slate-300">폭염·체감온도 안전보건 모니터링 및 리포트 자동화</p>
            </div>
            <nav className="flex gap-1 rounded-lg bg-slate-800 p-1 text-sm">
              <button onClick={() => setTab("dashboard")}
                className={`rounded px-3 py-1.5 ${tab === "dashboard" ? "bg-white text-slate-900" : "text-slate-300"}`}>대시보드</button>
              <button onClick={() => setTab("manage")}
                className={`rounded px-3 py-1.5 ${tab === "manage" ? "bg-white text-slate-900" : "text-slate-300"}`}>데이터 / 기기 관리</button>
            </nav>
          </div>
        </div>
      </header>

      {/* 컨트롤 바 */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end gap-3 px-4 py-3">
          <Field label="기기 선택">
            <select className="rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={deviceSn ?? ""} onChange={(e) => setDeviceSn(e.target.value || null)}>
              <option value="">(전체 사업장)</option>
              {devices.map((d) => (
                <option key={d.device_sn} value={d.device_sn}>
                  {d.company_name ? `${d.company_name} / ${d.location_name ?? ""}` : d.device_sn}
                </option>
              ))}
            </select>
          </Field>
          <Field label="기준 일자">
            <input type="date" className="rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="다운샘플링">
            <select className="rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={interval} onChange={(e) => setIntervalMin(Number(e.target.value))}>
              <option value={1}>1분(원본)</option>
              <option value={10}>10분 평균</option>
              <option value={30}>30분 평균</option>
            </select>
          </Field>
          <div className="mx-2 h-8 w-px bg-slate-200" />
          <Field label="리포트 기간(시작)">
            <input type="date" className="rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
          </Field>
          <Field label="리포트 기간(종료)">
            <input type="date" className="rounded border border-slate-300 px-2 py-1.5 text-sm"
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

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-5">
        {loadErr && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{loadErr}</div>
        )}

        {uploadNotice && tab === "dashboard" && (
          <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <span>✅ {uploadNotice}</span>
            <button onClick={() => setUploadNotice(null)} className="text-emerald-600 hover:text-emerald-800">✕</button>
          </div>
        )}

        {tab === "dashboard" ? (
          <>
            <KpiCards kpi={kpi} />
            <TimeSeriesChart ts={ts} kpi={kpi} />
            <WeatherCompareChart cmp={cmp} />
            <ReportPanel deviceSn={deviceSn} date={date} rangeStart={rangeStart} rangeEnd={rangeEnd} />
          </>
        ) : (
          <>
            <UploadPanel onUploaded={handleUploaded} />
            <DeviceManager devices={devices} onChange={loadDevices} />
          </>
        )}
      </main>

      <footer className="py-6 text-center text-xs text-slate-400">
        케이웨더 안전보건 대시보드 · 위험단계 기준(체감온도): 관심 31℃ / 주의 33℃ / 경고 35℃ / 위험 38℃
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
