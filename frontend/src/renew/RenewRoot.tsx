// 리뉴얼 실 진입점 — 부팅/인증 게이트 + react-router 셸(AppShell) + 컨텍스트 바.
// 운영 모드: 상시 네비(사이드바/모바일 탭) + 라우팅(/, /map, /report, /devices, /settings, /admin).
import {
  ActionIcon, AppShell, Badge, Box, Button, Center, Container, Group, Loader, Paper,
  SegmentedControl, Select, Stack, Text, Tooltip, useComputedColorScheme, useMantineColorScheme,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import {
  IconCalendar, IconDeviceDesktopAnalytics, IconFileText, IconLayoutDashboard, IconMenu2, IconUpload,
} from "@tabler/icons-react";
import {
  BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate,
} from "react-router-dom";
import { AuthScreen } from "../components/AuthScreen";
import { AdminPage } from "../components/AdminPage";
import { UploadModal } from "../components/UploadModal";
import { NavbarNested } from "../components/ui/NavbarNested";
import { SiteFooterLinks } from "../components/ui/SiteFooterLinks";
import { useDashboard } from "./DashboardProvider";
import { DashboardPage } from "./pages/DashboardPage";
import { ReportPage } from "./pages/ReportPage";
import { DevicesPage } from "./pages/DevicesPage";
import { SettingsPage } from "./pages/SettingsPage";

export function RenewRoot() {
  const { booting, auth, onAuthed } = useDashboard();
  if (booting) return <Center h="100vh"><Loader /></Center>;
  if (!auth) return <AuthScreen onAuthed={onAuthed} />;
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}

function Shell() {
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure(false);
  const { toggleColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme("light");
  const navigate = useNavigate();
  const loc = useLocation();
  const {
    auth, logout, devices, deviceSn, setDeviceSn, loadRange,
    uploadOpen, uploadTarget, openUpload, closeUpload, handleUploaded,
  } = useDashboard();

  const go = (to: string) => { navigate(to); closeMobile(); };
  const showContextBar = loc.pathname === "/";

  return (
    <>
      {/* 데스크톱 header 제거 — 상단 공간 확보. navbar 단일 + 모바일 햄버거. */}
      <AppShell
        navbar={{ width: 280, breakpoint: "md", collapsed: { mobile: !mobileOpened } }}
        padding="md"
        withBorder={false}
      >
        <AppShell.Navbar p={0}>
          <NavbarNested
            currentPath={loc.pathname}
            onNavigate={go}
            account={{ company: auth?.company_name ?? undefined, email: auth?.email ?? undefined, onLogout: logout }}
            devices={devices}
            currentDevice={deviceSn}
            onSelectDevice={(sn) => { setDeviceSn(sn); loadRange(sn); }}
            onUpload={(sn) => openUpload(sn)}
            colorScheme={computed}
            onToggleTheme={toggleColorScheme}
            isAdmin={!!auth?.is_admin}
            isDemo={!!auth?.is_demo}
          />
        </AppShell.Navbar>

        <AppShell.Main>
          <Container size={1200} px={0}>
            <Box pt={{ base: 44, md: 0 }} pb={{ base: 84, md: 0 }}>
              <Stack gap="md">
                {showContextBar && <ContextBar />}
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/report" element={<ReportPage />} />
                  <Route path="/devices" element={<DevicesPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route
                    path="/admin"
                    element={auth?.is_admin ? <AdminPage onClose={() => go("/")} /> : <Navigate to="/" replace />}
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                <SiteFooterLinks />
              </Stack>
            </Box>
          </Container>
        </AppShell.Main>
      </AppShell>

      {/* 모바일 전용 햄버거 (헤더 제거 대체) */}
      <ActionIcon
        hiddenFrom="md" variant="default" size="lg" radius="md" onClick={toggleMobile} aria-label="menu"
        style={{ position: "fixed", top: 8, left: 8, zIndex: 250 }}
      >
        <IconMenu2 size={20} />
      </ActionIcon>

      {/* 모바일 하단 탭 */}
      <Box
        hiddenFrom="md" px="md" py={6}
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 200,
          borderTop: "1px solid var(--mantine-color-default-border)", background: "var(--mantine-color-body)",
        }}
      >
        <Group justify="space-between">
          <TabItem icon={IconLayoutDashboard} label="대시보드" active={loc.pathname === "/"} onClick={() => go("/")} />
          <TabItem icon={IconFileText} label="리포트" active={loc.pathname === "/report"} onClick={() => go("/report")} />
          <TabItem icon={IconDeviceDesktopAnalytics} label="기기" active={loc.pathname === "/devices"} onClick={() => go("/devices")} />
          <TabItem icon={IconMenu2} label="메뉴" onClick={toggleMobile} />
        </Group>
      </Box>

      {/* 공통 업로더 — 전역 1개(nav [+] · 대시보드 위젯 공용) */}
      <UploadModal
        opened={uploadOpen} onClose={closeUpload} devices={devices}
        targetSn={uploadTarget} onUploaded={handleUploaded}
      />
    </>
  );
}

/** 컨텍스트 바 — 기기/기준일자/다운샘플링/리포트 기간 (실 상태 배선). */
function ContextBar() {
  const {
    auth, devices, deviceSn, setDeviceSn, loadRange, date, setDate, availableDates,
    interval, setIntervalMin, openUpload, lastUpload,
  } = useDashboard();
  const navigate = useNavigate();
  const isDemo = !!auth?.is_demo;
  const lastUploadAt = deviceSn && lastUpload[deviceSn] ? lastUpload[deviceSn].slice(0, 16).replace("T", " ") : null;

  return (
    <Paper withBorder radius="lg" shadow="xs" p="md">
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
        <Group align="flex-end" gap="md" wrap="wrap">
          <Select
            label="측정기" size="sm" w={260} allowDeselect={false}
            leftSection={<IconDeviceDesktopAnalytics size={16} />}
            value={deviceSn ?? ""}
            onChange={(v) => { const nv = v || null; setDeviceSn(nv); loadRange(nv); }}
            data={[
              { value: "", label: "전체 사업장" },
              ...devices.map((d) => ({
                value: d.device_sn,
                label: `${d.device_sn}${d.location_name ? ` · ${d.location_name}` : (d.company_name ? ` · ${d.company_name}` : "")}`,
              })),
            ]}
          />
          <Tooltip label={isDemo ? "데모 계정은 읽기 전용입니다" : (lastUploadAt ? `최근 업로드 ${lastUploadAt}` : "측정 데이터 업로드")} withArrow>
            <Button size="sm" variant="default" leftSection={<IconUpload size={16} />}
              disabled={isDemo} onClick={() => openUpload(deviceSn)}>업로드</Button>
          </Tooltip>
          {availableDates.length > 0 ? (
            <Select
              label="분석 일자" size="sm" w={170} allowDeselect={false}
              leftSection={<IconCalendar size={16} />}
              value={date} onChange={(v) => v && setDate(v)} data={availableDates}
            />
          ) : (
            <DatePickerInput label="분석 일자" size="sm" w={170} valueFormat="YYYY-MM-DD"
              leftSection={<IconCalendar size={16} />} value={date} onChange={(v) => v && setDate(v)} />
          )}
          <Box>
            <Text component="label" size="sm" fw={500} display="block" mb={5}>시간 간격</Text>
            <SegmentedControl
              size="sm" color="kw" value={String(interval)}
              onChange={(v) => setIntervalMin(Number(v))}
              data={[{ label: "10분 평균", value: "10" }, { label: "30분 평균", value: "30" }]}
            />
          </Box>
        </Group>
        <Group gap="xs">
          {isDemo && (
            <Badge color="gray" variant="light" size="lg" radius="sm">읽기 전용 데모</Badge>
          )}
          <Button size="sm" variant="light" color="kw"
            leftSection={<IconFileText size={16} />} onClick={() => navigate("/report")}>
            기간 통계 보고서
          </Button>
        </Group>
      </Group>
    </Paper>
  );
}

function TabItem({ icon: Icon, label, active, onClick }: { icon: typeof IconMenu2; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <Stack
      gap={2} align="center" onClick={onClick}
      style={{ flex: 1, cursor: "pointer", color: active ? "var(--mantine-color-kw-6)" : "var(--mantine-color-dimmed)" }}
    >
      <Icon size={20} />
      <Text fz={10} fw={active ? 700 : 500}>{label}</Text>
    </Stack>
  );
}
