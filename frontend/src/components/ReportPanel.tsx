import { useEffect, useState } from "react";
import { api } from "../api";
import type { DailyReport } from "../types";
import { HeatBadge } from "./HeatBadge";

export function ReportPanel({
  deviceSn, date, rangeStart, rangeEnd,
}: { deviceSn: string | null; date: string; rangeStart: string; rangeEnd: string }) {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!deviceSn) { setReport(null); return; }
    setLoading(true);
    api.dailyReport(deviceSn, date).then(setReport).catch(() => setReport(null)).finally(() => setLoading(false));
  }, [deviceSn, date]);

  const btn = "rounded-xl px-4 py-2.5 text-sm font-semibold transition";

  return (
    <div className="card">
      <h3 className="mb-3 font-semibold text-slate-900">안전관리 리포트</h3>

      {/* 다운로드 버튼 */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          disabled={!deviceSn}
          onClick={() => deviceSn && api.download(api.dailyPdfUrl(deviceSn, date), `daily_${deviceSn}_${date}.pdf`)}
          className={`${btn} bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40`}
        >📄 일일 보고서 PDF</button>
        <button
          onClick={() => api.download(api.periodicPdfUrl(deviceSn, rangeStart, rangeEnd), `periodic_${rangeStart}_${rangeEnd}.pdf`)}
          className={`${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
        >📑 기간 통계 PDF</button>
        <button
          onClick={() => api.download(api.excelUrl(deviceSn, rangeStart, rangeEnd), `export_${rangeStart}_${rangeEnd}.xlsx`)}
          className={`${btn} border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
        >📊 Excel 다운로드</button>
      </div>

      {/* 일일 보고서 미리보기 */}
      {loading ? (
        <p className="text-sm text-slate-400">불러오는 중...</p>
      ) : !deviceSn ? (
        <p className="text-sm text-slate-400">기기를 선택하면 일일 보고서 미리보기가 표시됩니다.</p>
      ) : report ? (
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm text-slate-500">
              {report.company_name} · {report.location_name} · {report.date}
            </div>
            <div>최고단계 <HeatBadge level={report.peak_level} size="sm" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            <Stat label="최고 체감온도" value={`${report.max_feels_like ?? "-"}℃`} sub={report.max_feels_like_time ?? ""} />
            <Stat label="최고 온도" value={`${report.max_temperature ?? "-"}℃`} />
            <Stat label="평균 습도" value={`${report.avg_humidity ?? "-"}%`} />
            <Stat label="33℃↑ 누적" value={`${report.minutes_over_33}분`} sub={`35℃ ${report.minutes_over_35}/38℃ ${report.minutes_over_38}`} />
          </div>
          <div className="mt-3">
            <div className="text-xs font-semibold text-slate-500">안전조치 이행 가이드</div>
            <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
              {report.guidance.map((g, i) => <li key={i}>{g}</li>)}
            </ul>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-400">해당 일자 데이터가 없습니다.</p>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-bold text-slate-800">{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}
