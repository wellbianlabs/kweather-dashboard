import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { IconFile, IconDownload, IconSpinner } from "./Icons";

const KIND_LABEL: Record<string, string> = {
  daily: "일일 안전 보고서(PDF)",
  periodic: "기간 통계 보고서(PDF)",
  excel: "Excel 데이터 파일",
};
import type { DailyReport } from "../types";
import { HeatBadge } from "./HeatBadge";

type Preview = { kind: string; url: string; blob: Blob; filename: string } | null;

export function ReportPanel({
  deviceSn, date, rangeStart, rangeEnd,
}: { deviceSn: string | null; date: string; rangeStart: string; rangeEnd: string }) {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [dlError, setDlError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!deviceSn) { setReport(null); return; }
    setLoading(true);
    api.dailyReport(deviceSn, date).then(setReport).catch(() => setReport(null)).finally(() => setLoading(false));
  }, [deviceSn, date]);

  // 미리보기 objectURL 정리(언마운트/교체 시 메모리 해제)
  useEffect(() => {
    return () => { if (preview?.url) URL.revokeObjectURL(preview.url); };
  }, [preview]);

  function friendlyError(e: any): string {
    let msg = String(e?.message || e);
    try { msg = JSON.parse(msg).detail ?? msg; } catch {}
    if (msg.includes("504") || msg.toLowerCase().includes("timeout")) {
      return "기간이 너무 길어 생성 시간이 초과되었습니다. 리포트 기간을 줄여 다시 시도해 주세요.";
    }
    return msg;
  }

  // PDF 를 화면에 먼저 표출(미리보기). 인증 헤더로 Blob 을 받아 임베드한다.
  async function showPreview(kind: string, url: string, filename: string) {
    setBusy(kind); setDlError(null);
    try {
      const blob = await api.fetchBlob(url);
      setPreview((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return { kind, url: URL.createObjectURL(blob), blob, filename };
      });
      // 미리보기 위치로 부드럽게 스크롤
      setTimeout(() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e: any) {
      setDlError(`미리보기 실패: ${friendlyError(e)}`);
    } finally {
      setBusy(null);
    }
  }

  // 다운로드 전용(미리보기 부적합한 Excel 등)
  async function downloadOnly(kind: string, url: string, filename: string) {
    setBusy(kind); setDlError(null);
    try {
      await api.download(url, filename);
    } catch (e: any) {
      setDlError(`다운로드 실패: ${friendlyError(e)}`);
    } finally {
      setBusy(null);
    }
  }

  function closePreview() {
    setPreview((prev) => { if (prev?.url) URL.revokeObjectURL(prev.url); return null; });
  }

  const btn = "rounded-xl px-4 py-2.5 text-sm font-semibold transition";

  return (
    <div className="card">
      {/* 생성 중 로딩 오버레이 */}
      {busy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-[2px]">
          <div className="mx-4 flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl bg-white px-8 py-9 shadow-lift">
            <IconSpinner className="h-11 w-11 text-kw" />
            <div className="text-center">
              <div className="text-base font-bold tracking-tight text-slate-900">
                {KIND_LABEL[busy] ?? "파일"} 생성 중
              </div>
              <div className="mt-1.5 text-sm leading-relaxed text-slate-500">
                데이터 양에 따라 최대 1분 정도 소요될 수 있습니다.<br />잠시만 기다려 주세요.
              </div>
            </div>
            <div className="h-1 w-40 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-1/3 animate-[loading_1.2s_ease-in-out_infinite] rounded-full bg-kw" />
            </div>
          </div>
        </div>
      )}

      <h3 className="mb-1 font-semibold text-slate-900">안전관리 리포트</h3>
      <p className="mb-3 text-xs text-slate-400">버튼을 누르면 화면에서 먼저 확인한 뒤 내려받을 수 있습니다.</p>

      {/* 보고서 생성/미리보기 버튼 */}
      <div className="mb-2 flex flex-wrap gap-2">
        <button
          disabled={!deviceSn || busy !== null}
          onClick={() => deviceSn && showPreview("daily", api.dailyPdfUrl(deviceSn, date), `daily_${deviceSn}_${date}.pdf`)}
          className={`${btn} bg-kw text-white hover:bg-kw-dark disabled:opacity-40`}
        ><span className="inline-flex items-center gap-2">{busy === "daily" ? <IconSpinner className="h-4 w-4" /> : <IconFile className="h-4 w-4" />}{busy === "daily" ? "생성 중…" : "일일 안전 보고서 (PDF)"}</span></button>
        <button
          disabled={busy !== null}
          onClick={() => showPreview("periodic", api.periodicPdfUrl(deviceSn, rangeStart, rangeEnd), `periodic_${rangeStart}_${rangeEnd}.pdf`)}
          className={`${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40`}
        ><span className="inline-flex items-center gap-2">{busy === "periodic" ? <IconSpinner className="h-4 w-4" /> : <IconFile className="h-4 w-4" />}{busy === "periodic" ? "생성 중…" : "기간 통계 보고서 (PDF)"}</span></button>
        <button
          disabled={busy !== null}
          onClick={() => downloadOnly("excel", api.excelUrl(deviceSn, rangeStart, rangeEnd), `export_${rangeStart}_${rangeEnd}.xlsx`)}
          className={`${btn} border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40`}
        ><span className="inline-flex items-center gap-2">{busy === "excel" ? <IconSpinner className="h-4 w-4" /> : <IconDownload className="h-4 w-4" />}{busy === "excel" ? "생성 중…" : "데이터 내보내기 (Excel)"}</span></button>
      </div>
      {dlError && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{dlError}</p>
      )}

      {/* PDF 미리보기 — 화면에 먼저 표출 + 다운로드 */}
      {preview && (
        <div ref={previewRef} className="mb-4 mt-1 overflow-hidden rounded-xl border border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-sm font-semibold text-slate-700">{KIND_LABEL[preview.kind] ?? "보고서"} 미리보기</span>
            <div className="flex gap-2">
              <button
                onClick={() => api.saveBlob(preview.blob, preview.filename)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-kw px-3 py-1.5 text-xs font-semibold text-white hover:bg-kw-dark"
              ><IconDownload className="h-3.5 w-3.5" />다운로드</button>
              <button
                onClick={closePreview}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
              >닫기</button>
            </div>
          </div>
          <iframe
            src={`${preview.url}#toolbar=1&view=FitH`}
            title="보고서 미리보기"
            className="h-[760px] w-full bg-slate-100"
          />
          <div className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-center text-[11px] text-slate-400">
            미리보기가 보이지 않으면 상단의 “다운로드”로 파일을 내려받아 확인하세요.
          </div>
        </div>
      )}

      {/* 일일 보고서 요약(빠른 수치 확인) */}
      {loading ? (
        <p className="text-sm text-slate-400">불러오는 중...</p>
      ) : !deviceSn ? (
        <p className="text-sm text-slate-400">기기를 선택하면 일일 보고서 요약이 표시됩니다.</p>
      ) : report ? (
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm text-slate-500">
              {report.company_name} · {report.location_name} · {report.date}
            </div>
            <div>최고단계 <HeatBadge level={report.peak_level} size="sm" /></div>
          </div>
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <Stat label="최고 체감온도" value={`${report.max_feels_like ?? "-"}℃`} sub={report.max_feels_like_time ?? ""} />
            <Stat label="최고 온도" value={`${report.max_temperature ?? "-"}℃`} />
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
