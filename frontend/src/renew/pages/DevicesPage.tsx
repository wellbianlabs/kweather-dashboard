// 기기 관리 페이지 — 측정기 등록 + 메타/지오코딩 관리. (업로드는 공통 업로더로 분리)
// ※ 등록 폼(DeviceRegister) 하단에 기기 목록(DeviceManager)이 이미 포함되어 있어 중복 렌더하지 않는다.
import { Stack } from "@mantine/core";
import { DeviceRegister } from "../../components/DeviceRegister";
import { useDashboard } from "../DashboardProvider";

export function DevicesPage() {
  const { devices, auth, loadDevices } = useDashboard();
  return (
    <Stack gap="md">
      <DeviceRegister devices={devices} defaultCompany={auth?.company_name ?? ""} onChange={loadDevices} />
    </Stack>
  );
}
