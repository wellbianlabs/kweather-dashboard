"""Vercel Python 서버리스 진입점.

이 파일이 있는 `backend/` 를 Vercel 프로젝트 루트로 배포한다.
모든 요청은 vercel.json 의 rewrite 로 이 함수에 전달되고, FastAPI 가 `/api/*` 라우팅을 처리한다.
"""
import os
import sys

# backend/ 를 import 경로에 추가 (app 패키지 접근)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# matplotlib 설정 디렉터리(쓰기 가능 위치) — 서버리스 /tmp
os.environ.setdefault("MPLCONFIGDIR", "/tmp/mpl")

from app.main import app  # noqa: E402

# Vercel Python 런타임이 ASGI 앱(`app`)을 그대로 구동한다.
