// 사이드바 nav — 상/하 구역 분리.
//  상단(메인) = 등록 측정기 목록(즉시 노출, 클릭=대시보드+해당 기기, [+]=업로드).
//  하단 = 보조 메뉴(리포트 · 기기 관리 · 관리자). 그 아래 계정/테마/로그아웃.
import {
  ActionIcon, Box, Button, Group, NavLink, ScrollArea, Text, Tooltip,
} from "@mantine/core";
import {
  IconDeviceDesktopAnalytics, IconFileText, IconLogout, IconMoon, IconPlus, IconShieldHalf, IconSun,
} from "@tabler/icons-react";
import type { Device } from "../../types";
import { AccountButton } from "./AccountButton";
import classes from "./NavbarNested.module.css";

// 보조 메뉴 공통 스타일
const ITEM_STYLES = {
  root: { borderRadius: "var(--mantine-radius-md)", padding: "11px 12px" },
  label: { fontSize: 15, fontWeight: 600 },
} as const;

interface NavbarNestedProps {
  currentPath?: string;
  onNavigate?: (to: string) => void;
  account?: { company?: string; email?: string; onLogout?: () => void };
  devices?: Device[];
  currentDevice?: string | null;
  onSelectDevice?: (sn: string | null) => void;
  onUpload?: (sn: string) => void;
  colorScheme?: "light" | "dark";
  onToggleTheme?: () => void;
  isAdmin?: boolean;
  isDemo?: boolean;
}

export function NavbarNested({
  currentPath, onNavigate, account, devices = [], currentDevice, onSelectDevice, onUpload,
  colorScheme = "light", onToggleTheme, isAdmin = false, isDemo = false,
}: NavbarNestedProps) {
  const onDash = currentPath === "/";

  return (
    <nav className={classes.navbar}>
      <div className={classes.header}>
        <img src="/kweather-logo.png" alt="KWEATHER" style={{ height: 22 }} />
      </div>

      {/* 상단: 등록 측정기 목록 */}
      <ScrollArea className={classes.navbarMain}>
        <Text className={classes.sectionLabel}>측정기</Text>
        {devices.length === 0 && <Text size="sm" c="dimmed" px="sm" py={8}>등록된 측정기가 없습니다</Text>}
        {devices.map((d) => {
          const cur = currentDevice === d.device_sn && onDash;
          return (
            <NavLink
              key={d.device_sn} mb={4}
              label={d.device_sn}
              description={d.location_name || d.company_name || undefined}
              active={cur} variant="light" color="kw"
              onClick={() => { onSelectDevice?.(d.device_sn); onNavigate?.("/"); }}
              leftSection={<Box w={8} h={8} style={{ borderRadius: 4, background: cur ? "var(--mantine-color-kw-6)" : "var(--mantine-color-gray-4)" }} />}
              rightSection={
                <Tooltip label={isDemo ? "데모 계정은 읽기 전용입니다" : "측정 데이터 업로드"} withArrow position="right">
                  <ActionIcon component="div" variant="light" color="kw" size="md" radius="sm" aria-label="upload"
                    disabled={isDemo} data-disabled={isDemo || undefined}
                    onClick={(e) => { e.stopPropagation(); if (!isDemo) onUpload?.(d.device_sn); }}>
                    <IconPlus size={16} />
                  </ActionIcon>
                </Tooltip>
              }
              styles={{
                root: { borderRadius: "var(--mantine-radius-md)", padding: "9px 10px" },
                label: { fontSize: 14.5, fontWeight: cur ? 700 : 600 },
                description: { fontSize: 12.5, marginTop: 3 },
              }}
            />
          );
        })}
      </ScrollArea>

      {/* 하단: 보조 메뉴 */}
      <div className={classes.bottomNav}>
        <NavLink label="리포트" active={currentPath === "/report"} variant="light" color="kw" mb={4} styles={ITEM_STYLES}
          leftSection={<IconFileText size={20} stroke={1.6} />} onClick={() => onNavigate?.("/report")} />
        <NavLink label="기기 관리" active={currentPath === "/devices"} variant="light" color="kw" mb={4} styles={ITEM_STYLES}
          leftSection={<IconDeviceDesktopAnalytics size={20} stroke={1.6} />} onClick={() => onNavigate?.("/devices")} />
        {isAdmin && (
          <NavLink label="관리자" active={currentPath === "/admin"} variant="light" color="kw" styles={ITEM_STYLES}
            leftSection={<IconShieldHalf size={20} stroke={1.6} />} onClick={() => onNavigate?.("/admin")} />
        )}
      </div>

      <div className={classes.footer}>
        <Group wrap="nowrap" gap={0}>
          <AccountButton company={account?.company} email={account?.email} onClick={() => onNavigate?.("/settings")} />
        </Group>
        <Group mt="sm" gap="xs" grow>
          {onToggleTheme && (
            <Button variant="default" size="xs" color="gray"
              leftSection={colorScheme === "dark" ? <IconSun size={15} /> : <IconMoon size={15} />}
              onClick={onToggleTheme}>{colorScheme === "dark" ? "라이트" : "다크"}</Button>
          )}
          {account?.onLogout && (
            <Button variant="default" size="xs" color="gray"
              leftSection={<IconLogout size={15} />} onClick={account.onLogout}>로그아웃</Button>
          )}
        </Group>
      </div>
    </nav>
  );
}
