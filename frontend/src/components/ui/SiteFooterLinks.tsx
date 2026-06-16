// 이식: Mantine UI "Footer with links" (ui.mantine.dev, MIT) — 콘텐츠=케이웨더
import { IconBrandYoutube, IconShoppingCart, IconWorld } from "@tabler/icons-react";
import { ActionIcon, Container, Group, Text } from "@mantine/core";
import classes from "./SiteFooterLinks.module.css";

const data = [
  { title: "회사", links: [{ label: "케이웨더 소개", link: "#" }, { label: "오시는 길", link: "#" }, { label: "채용", link: "#" }] },
  { title: "제품", links: [{ label: "체감온도계", link: "#" }, { label: "공기측정기", link: "#" }, { label: "케이웨더몰", link: "#" }] },
  { title: "지원", links: [{ label: "사용 가이드", link: "#" }, { label: "문의하기", link: "#" }, { label: "공지사항", link: "#" }] },
];

export function SiteFooterLinks() {
  const groups = data.map((group) => {
    const links = group.links.map((link, index) => (
      <Text key={index} className={classes.link} component="a" href={link.link} onClick={(e) => e.preventDefault()}>
        {link.label}
      </Text>
    ));
    return (
      <div className={classes.wrapper} key={group.title}>
        <Text className={classes.title}>{group.title}</Text>
        {links}
      </div>
    );
  });

  return (
    <footer className={classes.footer}>
      <Container className={classes.inner}>
        <div className={classes.logo}>
          <img src="/kweather-logo.png" alt="KWEATHER" style={{ height: 24 }} />
          <Text size="xs" c="dimmed" className={classes.description}>폭염·체감온도 안전보건 데이터 솔루션</Text>
        </div>
        <div className={classes.groups}>{groups}</div>
      </Container>
      <Container className={classes.afterFooter}>
        <Text c="dimmed" size="sm">© 2026 KWeather Inc. All rights reserved.</Text>
        <Group gap={0} className={classes.social} justify="flex-end" wrap="nowrap">
          <ActionIcon size="lg" color="gray" variant="subtle" aria-label="website"><IconWorld size={18} stroke={1.5} /></ActionIcon>
          <ActionIcon size="lg" color="gray" variant="subtle" aria-label="mall"><IconShoppingCart size={18} stroke={1.5} /></ActionIcon>
          <ActionIcon size="lg" color="gray" variant="subtle" aria-label="youtube"><IconBrandYoutube size={18} stroke={1.5} /></ActionIcon>
        </Group>
      </Container>
    </footer>
  );
}
