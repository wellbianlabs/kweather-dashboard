// 이식: Mantine UI "Navbar simple" (ui.mantine.dev, MIT)
// 원형 구조·CSS 유지, 콘텐츠=우리 IA / 브랜드=kw / 로고=케이웨더.
import { useState } from "react";
import {
  IconDeviceDesktopAnalytics, IconFileText, IconLayoutDashboard, IconLogout,
  IconMap2, IconSettings, IconShieldHalf, IconSwitchHorizontal,
} from "@tabler/icons-react";
import classes from "./AppNavbar.module.css";

const data = [
  { label: "대시보드", icon: IconLayoutDashboard },
  { label: "위험 지도", icon: IconMap2 },
  { label: "리포트", icon: IconFileText },
  { label: "기기 · 사업장", icon: IconDeviceDesktopAnalytics },
  { label: "설정", icon: IconSettings },
  { label: "관리자", icon: IconShieldHalf },
];

export function AppNavbar() {
  const [active, setActive] = useState("대시보드");

  const links = data.map((item) => (
    <a
      className={classes.link}
      data-active={item.label === active || undefined}
      href="#"
      key={item.label}
      onClick={(e) => { e.preventDefault(); setActive(item.label); }}
    >
      <item.icon className={classes.linkIcon} stroke={1.5} />
      <span>{item.label}</span>
    </a>
  ));

  return (
    <nav className={classes.navbar}>
      <div className={classes.navbarMain}>
        <div className={classes.header}>
          <img src="/kweather-logo.png" alt="KWEATHER" style={{ height: 22 }} />
        </div>
        {links}
      </div>

      <div className={classes.footer}>
        <a href="#" className={classes.link} onClick={(e) => e.preventDefault()}>
          <IconSwitchHorizontal className={classes.linkIcon} stroke={1.5} />
          <span>사업장 전환</span>
        </a>
        <a href="#" className={classes.link} onClick={(e) => e.preventDefault()}>
          <IconLogout className={classes.linkIcon} stroke={1.5} />
          <span>로그아웃</span>
        </a>
      </div>
    </nav>
  );
}
