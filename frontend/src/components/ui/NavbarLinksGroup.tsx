// 이식: Mantine UI "NavbarLinksGroup" (ui.mantine.dev, MIT) — 접히는 그룹 링크.
// 원형 유지 + 최상위 active 하이라이트(data-active) 추가.
import { useState } from "react";
import type { ComponentType } from "react";
import { IconChevronRight } from "@tabler/icons-react";
import { Box, Collapse, Group, Text, ThemeIcon, UnstyledButton } from "@mantine/core";
import classes from "./NavbarLinksGroup.module.css";

interface LinksGroupProps {
  icon: ComponentType<any>;
  label: string;
  active?: boolean;
  initiallyOpened?: boolean;
  to?: string;
  links?: { label: string; to: string }[];
  onNavigate?: (to: string) => void;
}

export function LinksGroup({ icon: Icon, label, active, initiallyOpened, to, links, onNavigate }: LinksGroupProps) {
  const hasLinks = Array.isArray(links);
  const [opened, setOpened] = useState(initiallyOpened || false);

  const items = (hasLinks ? links : []).map((link) => (
    <Text
      component="a"
      className={classes.link}
      href={link.to}
      key={link.label}
      onClick={(e) => { e.preventDefault(); onNavigate?.(link.to); }}
    >
      {link.label}
    </Text>
  ));

  return (
    <>
      <UnstyledButton
        onClick={() => { if (hasLinks) setOpened((o) => !o); else if (to) onNavigate?.(to); }}
        className={classes.control}
        data-active={active || undefined}
      >
        <Group justify="space-between" gap={0}>
          <Box style={{ display: "flex", alignItems: "center" }}>
            <ThemeIcon variant="light" size={30}>
              <Icon size={18} />
            </ThemeIcon>
            <Box ml="md">{label}</Box>
          </Box>
          {hasLinks && (
            <IconChevronRight
              className={classes.chevron}
              stroke={1.5}
              size={16}
              style={{ transform: opened ? "rotate(-90deg)" : "none" }}
            />
          )}
        </Group>
      </UnstyledButton>
      {hasLinks ? <Collapse expanded={opened}>{items}</Collapse> : null}
    </>
  );
}
