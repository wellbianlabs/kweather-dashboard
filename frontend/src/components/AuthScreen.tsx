import { useState } from "react";
import { api, setToken } from "../api";
import type { AuthData } from "../types";

export function AuthScreen({ onAuthed }: { onAuthed: (a: AuthData) => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const auth = mode === "login"
        ? await api.login(email, password)
        : await api.signup(email, password, company);
      setToken(auth.token);
      onAuthed(auth);
    } catch (err: any) {
      setError(String(err.message || err));
    } finally {
      setBusy(false);
    }
  }

  async function demo() {
    setBusy(true);
    setError(null);
    try {
      setToken("demo-key");
      const auth = await api.me();
      onAuthed(auth);
    } catch (err: any) {
      setError("데모 로그인 실패: " + String(err.message || err));
    } finally {
      setBusy(false);
    }
  }

  const inp = "input";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-4">
      <div className="w-full max-w-md">
        <div className="mb-7 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-900 text-2xl text-white shadow-lift">🌡️</span>
          <h1 className="mt-4 text-[22px] font-bold tracking-tight text-slate-900">케이웨더 체감온도계 대시보드</h1>
          <p className="mt-1 text-sm text-slate-500">폭염·체감온도 안전보건 모니터링</p>
          <span className="mt-3 inline-block rounded-full bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
            🎁 케이웨더 단말기 이용자 평생 무료
          </span>
        </div>

        <div className="rounded-3xl border border-slate-200/70 bg-white p-7 shadow-lift">
          <div className="mb-6 flex rounded-xl bg-slate-100/80 p-1 text-sm font-medium">
            <button
              onClick={() => { setMode("login"); setError(null); }}
              className={`flex-1 rounded-lg py-2 ${mode === "login" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}
            >로그인</button>
            <button
              onClick={() => { setMode("signup"); setError(null); }}
              className={`flex-1 rounded-lg py-2 ${mode === "signup" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}
            >회원가입</button>
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">회사명 / 사업장명</label>
                <input className={inp} value={company} onChange={(e) => setCompany(e.target.value)}
                       placeholder="(주)한국제강" required />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">이메일</label>
              <input type="email" className={inp} value={email} onChange={(e) => setEmail(e.target.value)}
                     placeholder="safety@company.com" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">비밀번호</label>
              <input type="password" className={inp} value={password} onChange={(e) => setPassword(e.target.value)}
                     placeholder="••••••••" required minLength={4} />
            </div>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

            <button type="submit" disabled={busy}
                    className="btn-primary w-full !py-3">
              {busy ? "처리 중..." : mode === "login" ? "로그인" : "회원가입하고 시작하기"}
            </button>
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
            <div className="h-px flex-1 bg-slate-200" /> 또는 <div className="h-px flex-1 bg-slate-200" />
          </div>
          <button onClick={demo} disabled={busy}
                  className="btn-ghost w-full !py-3">
            데모 계정으로 둘러보기
          </button>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          케이웨더 폭염온도계(체감온도계) 단말기 이용자 전용 서비스입니다.<br/>
          회사별로 격리된 안전한 공간에서 데이터를 관리하며, 단말기 이용자는 <b className="text-slate-600">평생 무료</b>로 사용합니다.
        </p>
      </div>
    </div>
  );
}
