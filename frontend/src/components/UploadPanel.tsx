import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { IconUpload } from "./Icons";
import type { Device, UploadResult } from "../types";

export function UploadPanel({
  devices = [],
  onUploaded,
  onReset,
}: {
  devices?: Device[];
  onUploaded: (results: UploadResult[]) => void;
  onReset?: () => void;
}) {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<UploadResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetNotice, setResetNotice] = useState<string | null>(null);
  // TXT 파일(파일 내 SN 없음)을 연결할 기기 — 기본값은 첫 번째 등록 기기
  const [targetSn, setTargetSn] = useState<string>(devices[0]?.device_sn ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  // 기기 목록이 늦게 로드되거나 선택 기기가 삭제된 경우 기본값 재설정
  useEffect(() => {
    if (devices.length && !devices.some((d) => d.device_sn === targetSn)) {
      setTargetSn(devices[0].device_sn);
    }
  }, [devices, targetSn]);

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setBusy(true);
    setError(null);
    setResults(null);
    setProgress({ done: 0, total: arr.length });
    try {
      const res = await api.upload(arr, (done, total) => setProgress({ done, total }), targetSn || null);
      setResults(res);
      onUploaded(res);
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function handleReset(scopeSn: string | null) {
    setBusy(true);
    setError(null);
    setResetNotice(null);
    try {
      const r = await api.resetData(scopeSn);
      setConfirmReset(false);
      setResults(null);
      setResetNotice(
        scopeSn
          ? `기기 ${scopeSn}의 측정 데이터 ${r.deleted_logs.toLocaleString()}건을 삭제했습니다.`
          : `전체 측정 데이터 ${r.deleted_logs.toLocaleString()}건을 삭제했습니다. (기기 등록 정보는 유지)`
      );
      onReset?.();
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setBusy(false);
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
    <div className="card">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900">측정 데이터 업로드 (TXT/CSV)</h3>
        <button
          className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-40"
          disabled={busy}
          onClick={() => { setConfirmReset((v) => !v); setResetNotice(null); }}
        >
          데이터 초기화
        </button>
      </div>

      {confirmReset && (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm">
          <p className="font-semibold text-red-700">업로드된 측정 데이터를 삭제합니다.</p>
          <p className="mt-0.5 text-xs text-red-600">
            삭제 후에는 되돌릴 수 없습니다. 기기 등록 정보와 계정은 유지되며, 파일을 다시 업로드하면 복원됩니다.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {targetSn && devices.length > 1 && (
              <button className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-40"
                      disabled={busy} onClick={() => handleReset(targetSn)}>
                선택 기기({targetSn})만 삭제
              </button>
            )}
            <button className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40"
                    disabled={busy} onClick={() => handleReset(null)}>
              전체 데이터 삭제
            </button>
            <button className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                    disabled={busy} onClick={() => setConfirmReset(false)}>
              취소
            </button>
          </div>
        </div>
      )}

      {resetNotice && (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {resetNotice}
        </div>
      )}
      {devices.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium text-slate-500">데이터를 연결할 기기</label>
          <select
            className="select !py-1.5 text-sm"
            value={targetSn}
            disabled={busy}
            onChange={(e) => setTargetSn(e.target.value)}
          >
            {devices.map((d) => (
              <option key={d.device_sn} value={d.device_sn}>
                {d.company_name ? `${d.company_name} / ${d.location_name ?? ""} (${d.device_sn})` : d.device_sn}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-400">TXT 파일은 SN이 없어 선택한 기기로 기록됩니다 (CSV는 파일 내 SN 사용)</span>
        </div>
      )}
      <div
        onDragOver={(e) => { e.preventDefault(); if (!busy) setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (!busy) handleFiles(e.dataTransfer.files); }}
        onClick={() => !busy && inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition
          ${busy ? "border-slate-200 bg-slate-100 cursor-wait" : drag ? "border-kw bg-kw-50" : "border-slate-200 bg-slate-50/60 hover:bg-slate-50"}`}
      >
        <input ref={inputRef} type="file" multiple accept=".txt,.TXT,.csv,.CSV,text/csv,text/plain" className="hidden"
               onChange={(e) => e.target.files && handleFiles(e.target.files)} />
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-kw-50 text-kw"><IconUpload className="h-5 w-5" /></span>
        <p className="mt-1 text-sm text-slate-600">
          {busy ? "업로드 중... (자동으로 나눠 전송합니다)" : "파일을 끌어다 놓거나 클릭하여 선택하세요"}
        </p>
        <p className="text-xs text-slate-400">
          지원 형식: 케이웨더 TXT(일자별 로그 — 시각·체감온도·온도·습도) 및 CSV(탭 구분 — DATE·TIME·SN·TEMP·HUMI·A-TEMP) · 다중 파일/대량 업로드 지원
        </p>
      </div>

      {/* 진행률 */}
      {progress && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>{progress.done.toLocaleString()} / {progress.total.toLocaleString()} 파일 처리</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-kw transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">오류: {error}</p>}

      {/* 결과 요약 */}
      {summary && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
          <div className="font-semibold text-slate-900">업로드 완료 — 파일 {summary.files.toLocaleString()}개</div>
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
