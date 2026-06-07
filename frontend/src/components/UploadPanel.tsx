import { useRef, useState } from "react";
import { api } from "../api";
import type { UploadResult } from "../types";

export function UploadPanel({ onUploaded }: { onUploaded: (results: UploadResult[]) => void }) {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<UploadResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | File[]) {
    if (!files || (files as FileList).length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.upload(files);
      setResults(res);
      onUploaded(res);
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-200">
      <h3 className="mb-2 font-semibold text-slate-700">CSV 로우데이터 업로드</h3>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition
          ${drag ? "border-blue-400 bg-blue-50" : "border-slate-300 bg-slate-50"}`}
      >
        <input ref={inputRef} type="file" multiple accept=".csv,.CSV,text/csv,text/plain" className="hidden"
               onChange={(e) => e.target.files && handleFiles(e.target.files)} />
        <div className="text-3xl">📄</div>
        <p className="mt-1 text-sm text-slate-600">
          {busy ? "업로드 중..." : "케이웨더 CSV(탭 구분) 파일을 끌어다 놓거나 클릭하여 선택"}
        </p>
        <p className="text-xs text-slate-400">DATE · TIME · SN · TEMP · HUMI · A-TEMP / 다중 파일 지원</p>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">오류: {error}</p>}

      {results && (
        <div className="mt-3 space-y-2">
          {results.map((r, i) => (
            <div key={i} className="rounded-lg bg-slate-50 p-2 text-xs">
              <div className="font-semibold text-slate-700">{r.filename} <span className="text-slate-400">({r.encoding})</span></div>
              <div className="text-slate-600">
                파싱 {r.rows_parsed} · 신규 {r.rows_inserted} · 갱신 {r.rows_updated} · 제외 {r.rows_skipped}
                {r.new_devices.length > 0 && <> · 신규기기 {r.new_devices.join(", ")}</>}
              </div>
              {r.errors.map((e, j) => <div key={j} className="text-red-500">· {e}</div>)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
