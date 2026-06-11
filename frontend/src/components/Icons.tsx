// 미니멀 라인 아이콘 세트 (lucide 스타일, 1.5px 스트로크) — 이모지 대체
type P = { className?: string };

function Base({ children, className }: P & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round" className={className ?? "h-4 w-4"} aria-hidden="true">
      {children}
    </svg>
  );
}

export const IconUpload = (p: P) => (
  <Base {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></Base>
);
export const IconFile = (p: P) => (
  <Base {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></Base>
);
export const IconDownload = (p: P) => (
  <Base {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></Base>
);
export const IconRefresh = (p: P) => (
  <Base {...p}><path d="M3 12a9 9 0 0 1 15.5-6.4L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.4L3 16"/><path d="M3 21v-5h5"/></Base>
);
export const IconSearch = (p: P) => (
  <Base {...p}><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></Base>
);
export const IconPin = (p: P) => (
  <Base {...p}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></Base>
);
export const IconAlert = (p: P) => (
  <Base {...p}><path d="M10.3 3.8 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></Base>
);
export const IconCheck = (p: P) => (
  <Base {...p}><polyline points="20 6 9 17 4 12"/></Base>
);
export const IconShield = (p: P) => (
  <Base {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></Base>
);
export const IconInfo = (p: P) => (
  <Base {...p}><circle cx="12" cy="12" r="9"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></Base>
);
