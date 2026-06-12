export type Step = 1 | 2 | 3 | 4;

const STEPS: { n: Step; label: string; desc: string }[] = [
  { n: 1, label: "계정", desc: "회원가입 / 로그인" },
  { n: 2, label: "사업장·기기 등록", desc: "회사 · 장소 · 기기 SN" },
  { n: 3, label: "데이터 업로드", desc: "TXT/CSV 파일" },
  { n: 4, label: "대시보드", desc: "분석 · 리포트" },
];

export function Stepper({
  current, onJump, canDashboard,
}: { current: Step; onJump: (s: Step) => void; canDashboard: boolean }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {STEPS.map((s, i) => {
        const done = s.n < current;
        const active = s.n === current;
        // 로그인 이후 2·3단계는 자유 이동, 4단계(대시보드)는 데이터가 있을 때만
        const clickable = s.n === 2 || s.n === 3 || (s.n === 4 && canDashboard);
        return (
          <div key={s.n} className="flex items-center">
            <button
              disabled={!clickable}
              onClick={() => clickable && onJump(s.n)}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition ${
                clickable ? "hover:bg-slate-100" : "cursor-default"
              }`}
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                done ? "bg-kw-sky text-white"
                : active ? "bg-kw text-white"
                : "bg-slate-200 text-slate-500"
              }`}>
                {done ? "✓" : s.n}
              </span>
              <span className="hidden md:block">
                <span className={`block text-xs font-semibold ${active ? "text-slate-900" : "text-slate-500"}`}>{s.label}</span>
                <span className="block text-[10px] text-slate-400">{s.desc}</span>
              </span>
            </button>
            {i < STEPS.length - 1 && <div className="mx-0.5 h-px w-3 bg-slate-300 md:w-6" />}
          </div>
        );
      })}
    </div>
  );
}
