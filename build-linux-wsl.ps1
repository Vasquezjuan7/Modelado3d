# ========================================================
# CodeCity Nexus 3D - Paquetes de Linux desde Windows (WSL)
# ========================================================
# Requiere WSL con Ubuntu (wsl --install -d Ubuntu) y Node.js 22 dentro de Ubuntu.
# Genera .AppImage, .deb y .tar.gz en la carpeta release a partir del último commit.

$distro = if ($env:CODECITY_WSL_DISTRO) { $env:CODECITY_WSL_DISTRO } else { "Ubuntu" }
$wslPath = (wsl -d $distro -- wslpath -a ($PSScriptRoot.Replace([char]92, [char]47))).Trim()
if ($LASTEXITCODE -ne 0 -or -not $wslPath) {
    Write-Host "No se pudo acceder a WSL ($distro). Instala Ubuntu con: wsl --install -d Ubuntu" -ForegroundColor Red
    exit 1
}

Write-Host ">>> Compilando Linux dentro de WSL ($distro)..." -ForegroundColor Cyan
wsl -d $distro -- bash "$wslPath/scripts/build-linux.sh"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error al compilar los paquetes de Linux." -ForegroundColor Red
    exit $LASTEXITCODE
}
Write-Host "`n>>> [COMPLETADO] Paquetes de Linux en la carpeta release" -ForegroundColor Green
