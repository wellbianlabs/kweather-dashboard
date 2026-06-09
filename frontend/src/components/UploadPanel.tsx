import { useMemo, useRef, useState } from "react";
import { api } from "../api";
import type { UploadResult } from "../types";

export function UploadPanel({ onUploaded }: { onUploaded: (results: UploadResult[]) => void }) {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<UploadResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setBusy(true);
    setError(null);
    setResults(null);
    setProgress({ done: 0, total: arr.length });
    try {
      const res = await api.upload(arr, (done, total) => setProgress({ done, total }));
      setResults(res);
      onUploaded(res);
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  // 대량 업로드 요약
  const summary = useMemo(() => {
    if (!results) return null;
    const inserted = results.reduce((s, r) => s + r.rows_inserted, 0);
    const updated = results.reduce((s, r) => s + r.rows_updated, 0);
    const skipped = results.reduce((s, r) => s + r.rows_skipped, 0);
    const devices = Array.from(new Set(results.flatMap((r) => r.affected_devices)));
    const failed = results.filter((r) => r.errors.length > 0);
    const dates = results.flatMap((r) => [r.min_date, r.max_date]).filter(Boolean) as string[];
    return {
      files: results.length, inserted, updated, skipped, devices, failed,
      min: dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null,
      max: dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null,
    };
  }, [results]);

  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-200">
      <h3 className="mb-2 font-semibold text-slate-700">CSV 로우데이터 업로드</h3>
      <div
        onDragOver={(e) => { e.preventDefault(); if (!busy) setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (!busy) handleFiles(e.dataTransfer.files); }}
        onClick={() => !busy && inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition
          ${busy ? "border-slate-200 bg-slate-100 cursor-wait" : drag ? "border-blue-400 bg-blue-50" : "border-slate-300 bg-slate-50"}`}
      >
        <input ref={inputRef} type="file" multiple accept=".csv,.CSV,text/csv,text/plain" className="hidden"
               onChange={(e) => e.target.files && handleFiles(e.target.files)} />
        <div className="text-3xl">📄</div>
        <p className="mt-1 text-sm text-slate-600">
          {busy ? "업로드 중... (자동으로 나눠 전송합니다)" : "케이웨더 CSV(탭 구분) 파일을 끌어다 놓거나 클릭하여 선택"}
        </p>
        <p className="text-xs text-slate-400">DATE · TIME · SN · TEMP · HUMI · A-TEMP / 다중 파일·대량 업로드 지원</p>
      </div>

      {/* 진행률 */}
      {progress && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>{progress.done.toLocaleString()} / {progress.total.toLocaleString()} 파일 처리</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">오류: {error}</p>}

      {/* 결과 요약 */}
      {summary && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
          <div className="font-semibold text-slate-700">업로드 완료 — 파일 {summary.files.toLocaleString()}개</div>
          <div className="mt-1 text-slate-600">
            신규 {summary.inserted.toLocaleString()} · 갱신 {summary.updated.toLocaleString()} · 제외 {summary.skipped.toLocaleString()}건
            {summary.min && <> · 기간 {summary.min}~{summary.max}</>}
          </div>
          {summary.devices.length > 0 && (
            <div className="mt-1 text-xs text-slate-500">기기: {summary.devices.join(", ")}</div>
          )}
          {summary.failed.length > 0 && (
            <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              <div className="font-semibold">실패 {summary.failed.length}건:</div>
              {summary.failed.slice(0, 8).map((r, i) => (
                <div key={i}>· {r.filename}: {r.errors[0]}</div>
              ))}
              {summary.failed.length > 8 && <div>… 외 {summary.failed.length - 8}건</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
