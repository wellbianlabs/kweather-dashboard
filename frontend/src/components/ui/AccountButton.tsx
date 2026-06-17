// 이식: Mantine UI "User button" (ui.mantine.dev, MIT) — 헤더/네비 계정 버튼
import { IconChevronRight } from "@tabler/icons-react";
import { Avatar, Group, Text, UnstyledButton } from "@mantine/core";
import classes from "./AccountButton.module.css";

export function AccountButton({
  company,
  email,
  onClick,
}: { company?: string; email?: string; onClick?: () => void }) {
  // 실제 계정값만 표시 — 미설정 시 가짜 신원을 넣지 않고 안전한 기본 라벨 사용.
  const name = (company || "").trim() || "내 계정";
  const sub = (email || "").trim() || "계정 설정";
  return (
    <UnstyledButton className={classes.user} onClick={onClick} style={{ flex: 1, minWidth: 0 }}>
      <Group wrap="nowrap">
        <Avatar radius="xl" color="kw" variant="filled">{name.slice(0, 1)}</Avatar>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" fw={500} truncate>{name}</Text>
          <Text c="dimmed" size="xs" truncate>{sub}</Text>
        </div>
        <IconChevronRight size={14} stroke={1.5} />
      </Group>
    </UnstyledButton>
  );
}
