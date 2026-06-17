// 리뉴얼 실 진입점 — 부팅/인증 게이트 + react-router 셸(AppShell) + 컨텍스트 바.
// 운영 모드: 상시 네비(사이드바/모바일 탭) + 라우팅(/, /map, /report, /devices, /settings, /admin).
import {
  ActionIcon, AppShell, Box, Center, Container, Group, Loader, Select, Stack, Text,
  useComputedColorScheme, useMantineColorScheme,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import {
  IconFileText, IconLayoutDashboard, IconMap2, IconMenu2, IconMoon, IconSun,
} from "@tabler/icons-react";
import {
  BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate,
} from "react-router-dom";
import { AuthScreen } from "../components/AuthScreen";
import { AdminPage } from "../components/AdminPage";
import { NavbarNested } from "../components/ui/NavbarNested";
import { SiteFooterLinks } from "../components/ui/SiteFooterLinks";
import { useDashboard } from "./DashboardProvider";
import { DashboardPage } from "./pages/DashboardPage";
import { MapPage } from "./pages/MapPage";
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
  const { auth, logout } = useDashboard();

  const go = (to: string) => { navigate(to); closeMobile(); };
  const showContextBar = ["/", "/map", "/report"].includes(loc.pathname);

  return (
    <>
      <AppShell
        header={{ height: 60 }}
        navbar={{ width: 280, breakpoint: "md", collapsed: { mobile: !mobileOpened } }}
        padding="md"
        withBorder={false}
      >
        <AppShell.Header style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}>
          <Group h="100%" px="md" justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <ActionIcon variant="subtle" color="gray" hiddenFrom="md" onClick={toggleMobile} aria-label="menu">
                <IconMenu2 size={20} />
              </ActionIcon>
              <img src="/kweather-logo.png" alt="KWEATHER" style={{ height: 22 }} />
            </Group>
            <Group gap="xs" wrap="nowrap">
              <ActionIcon variant="default" onClick={toggleColorScheme} aria-label="theme">
                {computed === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
              </ActionIcon>
            </Group>
          </Group>
        </AppShell.Header>

        <AppShell.Navbar p={0}>
          <NavbarNested
            currentPath={loc.pathname}
            onNavigate={go}
            account={{ company: auth?.company_name ?? undefined, email: auth?.email ?? undefined, onLogout: logout }}
          />
        </AppShell.Navbar>

        <AppShell.Main>
          <Container size={1440} px={0}>
            <Box pb={{ base: 84, md: 0 }}>
              <Stack gap="md">
                {showContextBar && <ContextBar />}
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/map" element={<MapPage />} />
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

      {/* 모바일 하단 탭 */}
      <Box
        hiddenFrom="md"
        px="md"
        py={6}
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 200,
          borderTop: "1px solid var(--mantine-color-default-border)", background: "var(--mantine-color-body)",
        }}
      >
        <Group justify="space-between">
          <TabItem icon={IconLayoutDashboard} label="대시보드" active={loc.pathname === "/"} onClick={() => go("/")} />
          <TabItem icon={IconMap2} label="지도" active={loc.pathname === "/map"} onClick={() => go("/map")} />
          <TabItem icon={IconFileText} label="리포트" active={loc.pathname === "/report"} onClick={() => go("/report")} />
          <TabItem icon={IconMenu2} label="메뉴" onClick={toggleMobile} />
        </Group>
      </Box>
    </>
  );
}

/** 컨텍스트 바 — 기기/기준일자/다운샘플링/리포트 기간 (실 상태 배선). */
function ContextBar() {
  const {
    devices, deviceSn, setDeviceSn, loadRange, date, setDate, availableDates,
    interval, setIntervalMin, rangeStart, setRangeStart, rangeEnd, setRangeEnd, selected,
  } = useDashboard();

  return (
    <Box
      px="md" py="sm"
      style={{
        border: "1px solid var(--mantine-color-default-border)", borderRadius: "var(--mantine-radius-lg)",
        background: "var(--mantine-color-body)",
      }}
    >
      <Group align="flex-end" gap="sm" wrap="wrap">
        <Select
          label="기기 선택" size="sm" w={240} allowDeselect={false}
          value={deviceSn ?? ""}
          onChange={(v) => { const nv = v || null; setDeviceSn(nv); loadRange(nv); }}
          data={[
            { value: "", label: "(전체 사업장)" },
            ...devices.map((d) => ({
              value: d.device_sn,
              label: `${d.device_sn}${d.location_name ? ` · ${d.location_name}` : (d.company_name ? ` · ${d.company_name}` : "")}`,
            })),
          ]}
        />
        {availableDates.length > 0 ? (
          <Select
            label="기준 일자 (데이터 보유일)" size="sm" w={180} allowDeselect={false}
            value={date} onChange={(v) => v && setDate(v)} data={availableDates}
          />
        ) : (
          <DatePickerInput label="기준 일자" size="sm" w={180} valueFormat="YYYY-MM-DD" value={date} onChange={(v) => v && setDate(v)} />
        )}
        <Select
          label="다운샘플링" size="sm" w={140} allowDeselect={false}
          value={String(interval)} onChange={(v) => v && setIntervalMin(Number(v))}
          data={[{ value: "10", label: "10분 평균" }, { value: "30", label: "30분 평균" }]}
        />
        <Box w={1} h={36} mx={4} style={{ alignSelf: "center", background: "var(--mantine-color-default-border)" }} />
        <DatePickerInput label="리포트 기간(시작)" size="sm" w={160} valueFormat="YYYY-MM-DD" value={rangeStart} onChange={(v) => v && setRangeStart(v)} />
        <DatePickerInput label="리포트 기간(종료)" size="sm" w={160} valueFormat="YYYY-MM-DD" value={rangeEnd} onChange={(v) => v && setRangeEnd(v)} />
        {selected && (
          <Box ml="auto" ta="right">
            <Text size="xs" fw={600} c="gray.7">{selected.device_sn}</Text>
            <Text size="xs" c="dimmed">{selected.address}</Text>
          </Box>
        )}
      </Group>
    </Box>
  );
}

function TabItem({ icon: Icon, label, active, onClick }: { icon: typeof IconMap2; label: string; active?: boolean; onClick?: () => void }) {
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
