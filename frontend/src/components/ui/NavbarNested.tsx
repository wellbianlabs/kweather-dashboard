// 이식: Mantine UI "NavbarNested" (ui.mantine.dev, MIT) — 접히는 그룹 사이드바.
// IA=우리 메뉴(리포트/설정/관리자 하위), 로고=케이웨더, 푸터=AccountButton(이식)+로그아웃.
// 라우터 인지: currentPath/onNavigate props(프레젠테이셔널 유지 — 라우터 의존 없음).
import { ActionIcon, Group, ScrollArea, Tooltip } from "@mantine/core";
import {
  IconAdjustments, IconDeviceDesktopAnalytics, IconFileText, IconLayoutDashboard,
  IconLogout, IconMap2, IconShieldHalf,
} from "@tabler/icons-react";
import { LinksGroup } from "./NavbarLinksGroup";
import { AccountButton } from "./AccountButton";
import classes from "./NavbarNested.module.css";

const NAV = [
  { label: "대시보드", icon: IconLayoutDashboard, to: "/" },
  { label: "위험 지도", icon: IconMap2, to: "/map" },
  {
    label: "리포트", icon: IconFileText, initiallyOpened: true,
    links: [
      { label: "일일 안전 보고서", to: "/report" },
      { label: "기간 통계 보고서", to: "/report" },
      { label: "Excel 내보내기", to: "/report" },
    ],
  },
  { label: "기기 · 사업장", icon: IconDeviceDesktopAnalytics, to: "/devices" },
  {
    label: "설정", icon: IconAdjustments,
    links: [
      { label: "폭염 임계값", to: "/settings" },
      { label: "표시 설정", to: "/settings" },
      { label: "테마(라이트/다크)", to: "/settings" },
    ],
  },
  {
    label: "관리자", icon: IconShieldHalf,
    links: [
      { label: "트래픽 추이", to: "/admin" },
      { label: "사업장(회원) 현황", to: "/admin" },
      { label: "접근 로그", to: "/admin" },
    ],
  },
];

interface NavbarNestedProps {
  currentPath?: string;
  onNavigate?: (to: string) => void;
  account?: { company?: string; email?: string; onLogout?: () => void };
}

export function NavbarNested({ currentPath, onNavigate, account }: NavbarNestedProps) {
  return (
    <nav className={classes.navbar}>
      <div className={classes.header}>
        <img src="/kweather-logo.png" alt="KWEATHER" style={{ height: 22 }} />
      </div>

      <ScrollArea className={classes.links}>
        <div className={classes.linksInner}>
          {NAV.map((item) => (
            <LinksGroup
              {...item}
              key={item.label}
              active={item.to ? currentPath === item.to : undefined}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </ScrollArea>

      <div className={classes.footer}>
        <Group justify="space-between" wrap="nowrap" gap="xs">
          <AccountButton company={account?.company} email={account?.email} onClick={() => onNavigate?.("/settings")} />
          {account?.onLogout && (
            <Tooltip label="로그아웃">
              <ActionIcon variant="subtle" color="gray" onClick={account.onLogout} aria-label="logout">
                <IconLogout size={18} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </div>
    </nav>
  );
}
