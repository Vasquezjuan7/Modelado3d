# ========================================================
# CodeCity Nexus 3D - Standalone Desktop Application Builder
# ========================================================

Write-Host ">>> [1/3] Compilando frontend Vite & TypeScript..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error en compilacion de TypeScript/Vite." -ForegroundColor Red
    exit $LASTEXITCODE
}

$tempOutputDir = "$env:LOCALAPPDATA\Temp\codecity-build"
$projectReleaseDir = Join-Path $PSScriptRoot "release"

Write-Host ">>> [2/3] Empaquetando ejecutables de escritorio para Windows (NSIS + Portable)..." -ForegroundColor Cyan
npx electron-builder --win --config.directories.output="$tempOutputDir"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error durante el empaquetado con electron-builder." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ">>> [3/3] Copiando ejecutables a la carpeta release del proyecto..." -ForegroundColor Cyan
if (!(Test-Path $projectReleaseDir)) {
    New-Item -ItemType Directory -Path $projectReleaseDir -Force | Out-Null
}
Copy-Item -Path "$tempOutputDir\*.exe" -Destination "$projectReleaseDir\" -Force

Write-Host "`n>>> [COMPLETADO CON EXITO] Ejecutables listos en:" -ForegroundColor Green
Get-ChildItem $projectReleaseDir -Filter "*.exe" | ForEach-Object {
    $sizeMB = [math]::Round($_.Length / 1MB, 2)
    Write-Host "  * $($_.Name) ($sizeMB MB)" -ForegroundColor Yellow
}
