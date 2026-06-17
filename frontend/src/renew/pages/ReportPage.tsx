// 리포트 페이지 — 웹 보고서 + PDF/Excel (실데이터, 컨텍스트 기간 배선).
import { ReportPanel } from "../../components/ReportPanel";
import { useDashboard } from "../DashboardProvider";

export function ReportPage() {
  const { deviceSn, date, rangeStart, rangeEnd } = useDashboard();
  return <ReportPanel deviceSn={deviceSn} date={date} rangeStart={rangeStart} rangeEnd={rangeEnd} />;
}
