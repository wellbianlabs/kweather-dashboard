import { MapContainer, TileLayer, CircleMarker, Tooltip as LTooltip } from "react-leaflet";
import type { MapMarker } from "../types";
import { HeatBadge } from "./HeatBadge";

export function MapView({ markers }: { markers: MapMarker[] }) {
  const withGeo = markers.filter((m) => m.latitude != null && m.longitude != null);
  // 대한민국 중심 기본값
  const center: [number, number] = withGeo.length
    ? [withGeo[0].latitude!, withGeo[0].longitude!]
    : [36.5, 127.8];

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-200">
      <h3 className="mb-2 font-semibold text-slate-700">위치 기반 실시간 위험도 지도</h3>
      <div className="h-[320px] overflow-hidden rounded-lg">
        <MapContainer center={center} zoom={withGeo.length ? 8 : 7} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {withGeo.map((m) => (
            <CircleMarker
              key={m.device_sn}
              center={[m.latitude!, m.longitude!]}
              radius={12}
              pathOptions={{ color: m.level.color, fillColor: m.level.color, fillOpacity: 0.7, weight: 2 }}
            >
              <LTooltip>
                <div className="text-xs">
                  <div className="font-bold">{m.company_name || m.device_sn}</div>
                  <div>{m.location_name}</div>
                  <div className="mt-1">
                    최고 체감 {m.max_feels_like ?? "-"}℃ <HeatBadge level={m.level} size="sm" />
                  </div>
                </div>
              </LTooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      {withGeo.length === 0 && (
        <p className="mt-2 text-xs text-slate-400">위경도가 등록된 기기가 없습니다. '기기 관리'에서 위치를 입력하세요.</p>
      )}
    </div>
  );
}
