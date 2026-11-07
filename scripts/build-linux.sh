#!/usr/bin/env bash
# Compila los paquetes de Linux (AppImage, .deb y .tar.gz) en un Linux real: WSL, una VM o un equipo Linux.
# Usa el último commit (no los cambios sin guardar) para que el resultado sea reproducible.
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$HOME/.local/node/bin:$PATH"

if ! command -v node >/dev/null 2>&1; then
  echo "Falta Node.js 22 en este Linux. Instálalo (https://nodejs.org) y vuelve a ejecutar el script." >&2
  exit 1
fi

WORK="${CODECITY_BUILD_DIR:-$HOME/.cache/codecity-build}"
echo ">>> [1/4] Copiando el último commit a $WORK"
rm -rf "$WORK"
git -c safe.directory='*' clone --quiet --no-local "$SRC" "$WORK"
cd "$WORK"

echo ">>> [2/4] Instalando dependencias (npm ci)"
npm ci --no-audit --no-fund

echo ">>> [3/4] Compilando la web y empaquetando para Linux"
npm run build
npx electron-builder --linux --publish never

echo ">>> [4/4] Copiando los paquetes a $SRC/release"
mkdir -p "$SRC/release"
cp -f release/*.AppImage release/*.deb release/*.tar.gz "$SRC/release/"
ls -lh "$SRC"/release/*linux* "$SRC"/release/*.deb 2>/dev/null || true
