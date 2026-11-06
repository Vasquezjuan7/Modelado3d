# CodeCity Nexus 3D

Convierte cualquier repositorio en una **ciudad 3D navegable** y audítalo con IA.

- **Altura** de cada edificio = líneas reales del archivo · **base** = nº de funciones · **distrito** = rol (UI, lógica, datos, infraestructura, tests, estilos, docs).
- **Tráfico**: los paquetes recorren las calles siguiendo el grafo **real** de imports del proyecto (modo estrés N+1 incluido).
- **Escáner offline** (sin clave): inyección SQL, XSS, `eval`, secretos, comandos de shell, deserialización insegura, N+1, God Objects… → mapa de calor de riesgo.
- **Auditoría con IA** (Google Gemini u OpenAI): hallazgos con línea exacta, diff lado a lado y archivo refactorizado (copiar, descargar o aplicar en disco en la app de escritorio).
- **Informe de arquitectura** del repositorio generado por IA.

La app arranca vacía: **tú eliges el repositorio** (URL de GitHub, `usuario/repo`, rama/subcarpeta con `/tree/rama/ruta`, o carpeta local en escritorio).

## Uso

```bash
npm install
npm run dev            # versión web en http://localhost:5173
npm run electron:dev   # app de escritorio en modo desarrollo (Windows, macOS y Linux)
npm run dist           # instaladores para el sistema actual, en release/
```

## Windows, macOS y Linux

| Sistema | Comando | Genera |
|---------|---------|--------|
| Windows 10/11 x64 | `npm run dist:win` | instalador NSIS `…-win-x64.exe` y versión portable `…-win-portable.exe` |
| macOS 11+ (Intel y Apple Silicon) | `npm run dist:mac` | `…-mac-x64.dmg`, `…-mac-arm64.dmg` y `.zip` |
| Linux x64 | `npm run dist:linux` | `.AppImage`, `.deb` (depende de `git`) y `.tar.gz` |

Cada instalador se compila en su propio sistema: el `.dmg` solo puede generarse en un Mac. Para obtener los tres sin tener cada sistema, usa **GitHub Actions** (`.github/workflows/build.yml`):

- **Actions → Build desktop apps → Run workflow**: compila en Windows, macOS y Ubuntu y deja los instaladores como artefactos de la ejecución.
- Subir una etiqueta (`git tag v2.0.1 && git push origin v2.0.1`) además los publica en una *Release* de GitHub.

Notas por sistema:

- **macOS**: la app no está firmada con un certificado de Apple. La primera vez, haz clic derecho sobre la app → *Abrir*, o ejecuta `xattr -cr "/Applications/CodeCity Nexus 3D.app"`. Para clonar repositorios hace falta git (`xcode-select --install` o `brew install git`); sin git, los repos de GitHub se cargan por la API.
- **Linux**: `chmod +x CodeCity-Nexus-3D-*.AppImage && ./CodeCity-Nexus-3D-*.AppImage`, o `sudo apt install ./CodeCity-Nexus-3D-*.deb`.
- **Windows**: SmartScreen o el Control inteligente de aplicaciones pueden avisar, porque el ejecutable no está firmado.

| Modo | Cómo carga el repositorio |
|------|---------------------------|
| Web | API REST de GitHub (estructura) + `raw.githubusercontent.com` (contenido real). Sin token: 60 peticiones/h a la API; añade un token en **Ajustes → GitHub** para repos privados o uso intensivo. |
| Escritorio | `git clone --depth 1` nativo (GitHub, GitLab, Bitbucket, servidores propios) o **Abrir carpeta local**. |

Límites: se muestran los 1.500 archivos más grandes; en web se descarga el contenido de hasta 900 archivos (≤ 400 KB).

## IA

**Ajustes → Inteligencia artificial**:

1. Elige *Google Gemini* y pega tu clave de [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (formatos `AIza…` y `AQ.…`).
2. Pulsa **Probar conexión**: lista los modelos disponibles para tu clave y deja seleccionado uno que responda.
3. Si un modelo está saturado (503), agotó su cuota gratuita (429), no responde o Google lo retiró, la app reintenta y cambia sola a otro modelo Flash estable de tu lista, y te indica cuál respondió.

La clave se guarda solo en el equipo (localStorage) y se envía únicamente a la API del proveedor.

## Cuentas (opcional)

Sin configuración, las cuentas se guardan localmente. Con Supabase (Ajustes → Cuenta y nube) se usan cuentas reales y cada auditoría se registra en `code_audits`; el esquema SQL se copia desde ese mismo panel.

## Estructura

```
electron/main.cjs, preload.cjs   proceso principal + puente IPC seguro (clone, escaneo, escritura)
src/lib/repoLoader.ts            ingesta (git / GitHub API / carpeta local)
src/lib/codeMetrics.ts           LOC, SLOC, funciones, imports y grafo de dependencias
src/lib/cityLayout.ts            distritos, manzanas, alturas y calles
src/lib/aiEngine.ts              escáner offline + Gemini + OpenAI
src/lib/diff.ts                  diff por líneas (LCS)
src/scene/*                      escena 3D (edificios instanciados con shader propio, tráfico, arcos)
src/ui/*                         interfaz (landing, paneles, modales)
```
