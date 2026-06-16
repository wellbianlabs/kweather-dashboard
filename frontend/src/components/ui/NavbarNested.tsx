// 이식: Mantine UI "NavbarNested" (ui.mantine.dev, MIT) — 접히는 그룹 사이드바.
// IA=우리 메뉴(리포트/설정/관리자 하위), 로고=케이웨더, 푸터=AccountButton(이식).
import { ScrollArea } from "@mantine/core";
import {
  IconAdjustments, IconDeviceDesktopAnalytics, IconFileText, IconLayoutDashboard,
  IconMap2, IconShieldHalf,
} from "@tabler/icons-react";
import { LinksGroup } from "./NavbarLinksGroup";
import { AccountButton } from "./AccountButton";
import classes from "./NavbarNested.module.css";

const NAV = [
  { label: "대시보드", icon: IconLayoutDashboard, active: true },
  { label: "위험 지도", icon: IconMap2 },
  {
    label: "리포트", icon: IconFileText, initiallyOpened: true,
    links: [
      { label: "일일 안전 보고서", link: "#" },
      { label: "기간 통계 보고서", link: "#" },
      { label: "Excel 내보내기", link: "#" },
    ],
  },
  { label: "기기 · 사업장", icon: IconDeviceDesktopAnalytics },
  {
    label: "설정", icon: IconAdjustments,
    links: [
      { label: "폭염 임계값", link: "#" },
      { label: "표시 설정", link: "#" },
      { label: "테마(라이트/다크)", link: "#" },
    ],
  },
  {
    label: "관리자", icon: IconShieldHalf,
    links: [
      { label: "트래픽 추이", link: "#" },
      { label: "사업장(회원) 현황", link: "#" },
      { label: "접근 로그", link: "#" },
    ],
  },
];

export function NavbarNested() {
  return (
    <nav className={classes.navbar}>
      <div className={classes.header}>
        <img src="/kweather-logo.png" alt="KWEATHER" style={{ height: 22 }} />
      </div>

      <ScrollArea className={classes.links}>
        <div className={classes.linksInner}>
          {NAV.map((item) => <LinksGroup {...item} key={item.label} />)}
        </div>
      </ScrollArea>

      <div className={classes.footer}>
        <AccountButton />
      </div>
    </nav>
  );
}
