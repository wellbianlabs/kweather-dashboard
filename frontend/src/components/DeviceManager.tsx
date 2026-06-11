import { useState } from "react";
import { api } from "../api";
import type { Device } from "../types";

export function DeviceManager({ devices, onChange }: { devices: Device[]; onChange: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Device>>({});
  const [saving, setSaving] = useState(false);

  function startEdit(d: Device) {
    setEditing(d.device_sn);
    setDraft({ ...d });
  }

  async function save(sn: string) {
    setSaving(true);
    try {
      await api.updateDevice(sn, {
        company_name: draft.company_name ?? null,
        location_name: draft.location_name ?? null,
        address: draft.address ?? null,
        latitude: draft.latitude === undefined || (draft.latitude as any) === "" ? null : Number(draft.latitude),
        longitude: draft.longitude === undefined || (draft.longitude as any) === "" ? null : Number(draft.longitude),
        region_code: draft.region_code ?? null,
      });
      setEditing(null);
      onChange();
    } finally {
      setSaving(false);
    }
  }

  async function remove(sn: string) {
    if (!confirm(`기기 ${sn} 와(과) 해당 측정 데이터를 모두 삭제할까요?`)) return;
    await api.deleteDevice(sn);
    onChange();
  }

  const inp = "w-full rounded-lg border border-slate-200 px-2 py-1 text-sm focus:border-slate-400 focus:outline-none";

  return (
    <div className="card">
      <h3 className="mb-2 font-semibold text-slate-900">기기 / 사업장 메타데이터 관리</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-slate-500">
              <th className="py-2 pr-2">기기 SN</th>
              <th className="pr-2">회사명</th>
              <th className="pr-2">설치 위치</th>
              <th className="pr-2">주소</th>
              <th className="pr-2">위도</th>
              <th className="pr-2">경도</th>
              <th className="pr-2">지역코드</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => {
              const ed = editing === d.device_sn;
              return (
                <tr key={d.device_sn} className="border-b last:border-0">
                  <td className="py-2 pr-2 font-mono text-xs">{d.device_sn}</td>
                  {ed ? (
                    <>
                      <td className="pr-2"><input className={inp} value={draft.company_name ?? ""} onChange={(e) => setDraft({ ...draft, company_name: e.target.value })} /></td>
                      <td className="pr-2"><input className={inp} value={draft.location_name ?? ""} onChange={(e) => setDraft({ ...draft, location_name: e.target.value })} /></td>
                      <td className="pr-2"><input className={inp} value={draft.address ?? ""} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></td>
                      <td className="pr-2"><input className={inp} value={draft.latitude ?? ""} onChange={(e) => setDraft({ ...draft, latitude: e.target.value as any })} /></td>
                      <td className="pr-2"><input className={inp} value={draft.longitude ?? ""} onChange={(e) => setDraft({ ...draft, longitude: e.target.value as any })} /></td>
                      <td className="pr-2"><input className={inp} value={draft.region_code ?? ""} onChange={(e) => setDraft({ ...draft, region_code: e.target.value })} /></td>
                      <td className="whitespace-nowrap">
                        <button disabled={saving} onClick={() => save(d.device_sn)} className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-700">저장</button>
                        <button onClick={() => setEditing(null)} className="ml-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">취소</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="pr-2">{d.company_name || <span className="text-slate-300">-</span>}</td>
                      <td className="pr-2">{d.location_name || <span className="text-slate-300">-</span>}</td>
                      <td className="pr-2 text-slate-500">{d.address || "-"}</td>
                      <td className="pr-2 text-slate-500">{d.latitude ?? "-"}</td>
                      <td className="pr-2 text-slate-500">{d.longitude ?? "-"}</td>
                      <td className="pr-2 text-slate-500">{d.region_code || "-"}</td>
                      <td className="whitespace-nowrap">
                        <button onClick={() => startEdit(d)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">편집</button>
                        <button onClick={() => remove(d.device_sn)} className="ml-1 rounded-lg px-2.5 py-1 text-xs text-red-500 hover:bg-red-50">삭제</button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            {devices.length === 0 && (
              <tr><td colSpan={8} className="py-4 text-center text-slate-400">등록된 기기가 없습니다. CSV를 업로드하면 자동 등록됩니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
