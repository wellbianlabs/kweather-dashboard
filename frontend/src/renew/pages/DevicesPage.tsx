// 기기 · 사업장 페이지 — 등록 + 측정 데이터 업로드 + 기기 관리(메타/지오코딩).
import { Stack } from "@mantine/core";
import { DeviceRegister } from "../../components/DeviceRegister";
import { DeviceManager } from "../../components/DeviceManager";
import { UploadPanel } from "../../components/UploadPanel";
import { useDashboard } from "../DashboardProvider";

export function DevicesPage() {
  const { devices, auth, loadDevices, handleUploaded, handleReset } = useDashboard();
  return (
    <Stack gap="md">
      <DeviceRegister devices={devices} defaultCompany={auth?.company_name ?? ""} onChange={loadDevices} />
      <UploadPanel devices={devices} onUploaded={handleUploaded} onReset={handleReset} />
      <DeviceManager devices={devices} onChange={loadDevices} />
    </Stack>
  );
}
