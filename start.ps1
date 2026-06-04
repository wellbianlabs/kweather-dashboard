# 케이웨더 체감온도계 대시보드 - 개발 실행 스크립트
# 백엔드(FastAPI :8000)와 프론트엔드(Vite :5173)를 동시에 기동합니다.
# 사용:  .\start.ps1            (백엔드+프론트 dev 서버)
#        .\start.ps1 -Seed      (실행 전 샘플 데이터 시드)

param([switch]$Seed)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$py = Join-Path $root "backend\.venv\Scripts\python.exe"

if (-not (Test-Path $py)) {
  Write-Host "가상환경이 없습니다. 생성 후 의존성을 설치합니다..." -ForegroundColor Yellow
  $base = "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"
  & $base -m venv (Join-Path $root "backend\.venv")
  & $py -m pip install --upgrade pip
  & $py -m pip install -r (Join-Path $root "backend\requirements.txt")
}

if ($Seed) {
  Write-Host "샘플 데이터 시드 중..." -ForegroundColor Cyan
  Push-Location (Join-Path $root "backend"); & $py seed.py; Pop-Location
}

Write-Host "백엔드 기동: http://127.0.0.1:8000  (API 문서: /docs)" -ForegroundColor Green
$backend = Start-Process -FilePath $py `
  -ArgumentList "-m","uvicorn","app.main:app","--host","127.0.0.1","--port","8000","--reload" `
  -WorkingDirectory (Join-Path $root "backend") -PassThru -WindowStyle Normal

Write-Host "프론트엔드 기동: http://127.0.0.1:5173" -ForegroundColor Green
Push-Location (Join-Path $root "frontend")
npm run dev
Pop-Location

# 프론트 종료 시 백엔드도 정리
if ($backend -and -not $backend.HasExited) { Stop-Process -Id $backend.Id -Force }
