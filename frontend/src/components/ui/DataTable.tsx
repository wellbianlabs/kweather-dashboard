// 이식: Mantine UI "Table with scroll area" (sticky header, ui.mantine.dev, MIT)
// clsx 의존 제거(템플릿 문자열로 대체), 콘텐츠=기기/현장 데이터.
import { useState } from "react";
import { ScrollArea, Table } from "@mantine/core";
import classes from "./DataTable.module.css";

const data = [
  { sn: "DEMO-A001", company: "데모 제강(주)", location: "제2공장 정련로 앞", feels: "38.6℃", level: "위험" },
  { sn: "DEMO-A002", company: "데모 제강(주)", location: "압연공정 라인 B", feels: "34.2℃", level: "주의" },
  { sn: "DEMO-B001", company: "데모 물류(주)", location: "옥외 상하차장", feels: "31.8℃", level: "관심" },
  { sn: "DEMO-C001", company: "데모 건설(주)", location: "3공구 가설현장", feels: "36.9℃", level: "경고" },
  { sn: "DEMO-C002", company: "데모 건설(주)", location: "타워크레인 운전실", feels: "33.4℃", level: "주의" },
  { sn: "DEMO-D001", company: "데모 식품(주)", location: "살균공정 라인", feels: "37.5℃", level: "경고" },
  { sn: "DEMO-D002", company: "데모 식품(주)", location: "냉동창고 입출고", feels: "29.1℃", level: "안전" },
  { sn: "DEMO-E001", company: "데모 화학(주)", location: "반응기 A동", feels: "39.2℃", level: "위험" },
];

export function DataTable() {
  const [scrolled, setScrolled] = useState(false);

  const rows = data.map((row) => (
    <Table.Tr key={row.sn}>
      <Table.Td>{row.sn}</Table.Td>
      <Table.Td>{row.company}</Table.Td>
      <Table.Td>{row.location}</Table.Td>
      <Table.Td>{row.feels}</Table.Td>
      <Table.Td>{row.level}</Table.Td>
    </Table.Tr>
  ));

  return (
    <ScrollArea h={280} onScrollPositionChange={({ y }) => setScrolled(y !== 0)}>
      <Table miw={760}>
        <Table.Thead className={`${classes.header}${scrolled ? ` ${classes.scrolled}` : ""}`}>
          <Table.Tr>
            <Table.Th>기기 SN</Table.Th>
            <Table.Th>회사</Table.Th>
            <Table.Th>설치 위치</Table.Th>
            <Table.Th>현재 체감</Table.Th>
            <Table.Th>위험단계</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{rows}</Table.Tbody>
      </Table>
    </ScrollArea>
  );
}
