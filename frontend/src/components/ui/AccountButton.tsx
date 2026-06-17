// 이식: Mantine UI "User button" (ui.mantine.dev, MIT) — 헤더/네비 계정 버튼
import { IconChevronRight } from "@tabler/icons-react";
import { Avatar, Group, Text, UnstyledButton } from "@mantine/core";
import classes from "./AccountButton.module.css";

export function AccountButton({
  company = "데모 제강(주)",
  email = "safety@demo-steel.co.kr",
  onClick,
}: { company?: string; email?: string; onClick?: () => void }) {
  return (
    <UnstyledButton className={classes.user} onClick={onClick} style={{ flex: 1, minWidth: 0 }}>
      <Group wrap="nowrap">
        <Avatar radius="xl" color="kw" variant="filled">{company.slice(0, 1)}</Avatar>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" fw={500} truncate>{company}</Text>
          <Text c="dimmed" size="xs" truncate>{email}</Text>
        </div>
        <IconChevronRight size={14} stroke={1.5} />
      </Group>
    </UnstyledButton>
  );
}
