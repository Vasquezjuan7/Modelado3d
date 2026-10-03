---
name: Cyber Tactical Metropole
colors:
  surface: '#10131c'
  surface-dim: '#10131c'
  surface-bright: '#363942'
  surface-container-lowest: '#0b0e16'
  surface-container-low: '#181b24'
  surface-container: '#1c1f28'
  surface-container-high: '#262a33'
  surface-container-highest: '#31353e'
  on-surface: '#e0e2ee'
  on-surface-variant: '#b9caca'
  inverse-surface: '#e0e2ee'
  inverse-on-surface: '#2d3039'
  outline: '#849495'
  outline-variant: '#3a494a'
  surface-tint: '#00dce5'
  primary: '#e9feff'
  on-primary: '#003739'
  primary-container: '#00f5ff'
  on-primary-container: '#006c71'
  inverse-primary: '#00696e'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#fef8ff'
  on-tertiary: '#3c0091'
  tertiary-container: '#e5d7ff'
  on-tertiary-container: '#703eda'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#63f7ff'
  primary-fixed-dim: '#00dce5'
  on-primary-fixed: '#002021'
  on-primary-fixed-variant: '#004f53'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#e9ddff'
  tertiary-fixed-dim: '#d0bcff'
  on-tertiary-fixed: '#23005c'
  on-tertiary-fixed-variant: '#5516be'
  background: '#10131c'
  on-background: '#e0e2ee'
  surface-variant: '#31353e'
typography:
  display-xl:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.03em
  display-xl-mobile:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  title-sm:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 24px
    letterSpacing: 0em
  body-lg:
    fontFamily: Space Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0.01em
  body-md:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0.01em
  mono-code:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: -0.01em
  telemetry-label:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.08em
  micro-coordinate:
    fontFamily: JetBrains Mono
    fontSize: 9px
    fontWeight: '400'
    lineHeight: 12px
    letterSpacing: 0.12em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-lg: 1.5rem
  margin: 1rem
  margin-md: 1.5rem
  margin-lg: 2.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system channels an ultra-premium, tactical sci-fi HUD aesthetic optimized for volumetric data rendering and 3D AST (Abstract Syntax Tree) code mapping. Blending military-grade telemetry ergonomics with speculative cyber-metropolis interfaces, it caters to elite systems architects, reverse engineers, and high-velocity platform operators.

The visual language evokes the sensation of commanding a vast, interconnected digital grid: authoritative, razor-sharp, and unyielding. The interface balances high-density information architecture with visceral feedback cues—utilizing ambient photon bleeds, luminous laser-thin borders, and low-noise obsidian planes. Rather than decorative gimmickry, every optical trace, coordinate readout, and optical glass panel serves to index spatial orientation, code complexity, and live system velocity.

## Colors

The palette is engineered specifically for deep-void environments, maximizing readability against complex 3D viewports while keeping luminance fatigue low over long operational spans.

- **Deep Space Matrix (Neutral Base):** Core canvas background is anchored at `#060911`, stepping up to `#0a0f1d` for primary container surfaces, and `#111827` for elevated floating panels.
- **Electric Cyan (`#00f5ff` / `#06b6d4`):** Primary command channel, vector focus indicators, tactical target reticles, and system-wide default interactive state.
- **Hyper-Saturated Emerald (`#10b981`):** Operational health, clean unit tests, optimal throughput, verified telemetry routes, and successful pipeline deployments.
- **Async Violet (`#8b5cf6`):** Secondary actor routines, background thread workers, concurrency trees, and parallel spatial nodes.
- **Critical Plasma / Hazard Amber (`#f59e0b` / `#ff5722`):** System hot-spots, technical debt alerts, cyclomatic churn thresholds, buffer overflows, and critical AST anomalies.
- **Ghost Monochrome (Overlays & Dividers):** High-attenuation cyan tinted whites (`rgba(0, 245, 255, 0.08)` to `rgba(255, 255, 255, 0.15)`) for grid crosshairs, hairline borders, and dimensional calipers.

## Typography

The type ecosystem establishes a strict dual-discipline hierarchy:
1. **Structural Display & Body (`Space Grotesk`):** Delivers aerodynamic, forward-thrusting geometry with humanistic mechanical quirks. Headlines are set tight with slight negative tracking to preserve structural density.
2. **Tactical Telemetry & Monospace (`JetBrains Mono`):** Governs all data tables, AST node identifiers, file paths, coordinates, and micro-HUD labels. Upper-case tracking for telemetry tokens is pushed to `+0.08em` through `+0.12em` to guarantee instant scanability at tiny scales.

Bilingual display requirements (EN/ES) are natively accounted for: Spanish string expansion (~15-25%) is mitigated through dynamic line clamps and robust column container tolerances, while retaining tabular character alignments across metrics.

## Layout & Spacing

The viewport relies on a fluid tactical grid wrapped around a centralized, persistent 3D spatial viewport canvas.

- **Docked HUD Framing:** The canvas utilizes a border-pinned telemetry layout with collapsible tool arrays:
  - **Left Rail (System/Tree Navigator):** Fixed 280px to 340px width dock.
  - **Right Dock (Inspector & Hotspot Telemetry):** Fixed 360px dock.
  - **Bottom Deck (Console, Timeline & Query Bar):** Collapsible 240px drawer.
- **Breakpoints:**
  - `Desktop (>= 1440px)`: Full multi-pane HUD with dual pinned docks and top status strip.
  - `Tablet / Medium (768px - 1439px)`: Side docks convert to contextual sliding glass drawers with persistent quick-action trigger bars.
  - `Mobile (< 768px)`: Single-focus layout; 3D viewport operates as the active backdrop while metrics and AST inspectors collapse into swipeable bottom sheets.
- **Rhythm & Safe Margins:** Component spacing enforces strict multiples of 4px/8px, maintaining alignment with terminal grid lines and digital calipers. Outer canvas clearance guarantees zero occlusion with hardware sensor notches or floating controls.

## Elevation & Depth

Visual depth is achieved through an optical fusion of tinted glassmorphism, photonic edge glows, and void-tier background stacking:

- **Surface Layering:**
  - `Base Floor (#060911)`: Infinite 3D canvas and spatial world background.
  - `Tier 1 Container (#0a0f1d / 75% opacity with 16px backdrop-blur)`: Pinned toolbars, telemetry sidebars, and contextual inspectors.
  - `Tier 2 Floating Heads-Up Overlay (#111827 / 85% opacity with 24px backdrop-blur)`: Modals, active context menus, hover cards, and command palettes.
- **Edge Architecture:** Physical box shadows are rejected in favor of high-energy photon borders:
  - 1px hairline border: `rgba(0, 245, 255, 0.18)` resting, elevating to `rgba(0, 245, 255, 0.65)` with an outer `0 0 12px rgba(0, 245, 255, 0.35)` drop-glow on focus or active target lock.
  - Critical/Danger panels project an ambient hazard aura: `0 0 16px rgba(255, 87, 34, 0.3)` accompanied by a 1px border of `rgba(255, 87, 34, 0.8)`.
- **Telemetry Calipers:** Panels feature subtle pseudo-element corner brackets (`+` or `L-brackets`) measuring 6px in length to reinforce the HUD diagnostic aesthetic.

## Shapes

The shape system adopts a precision industrial profile (`roundedness: 1` = 0.25rem / 4px).

Surfaces deliberately avoid bulbous or pill-like geometries to preserve a military avionics and developer console tone. Corners are crisp, tightly disciplined, and frequently accented with chamfered 45-degree corner cutouts (2px to 6px diagonal notches) via clip-paths on primary action controls, system tags, and HUD framing cards.

## Components

### Buttons & Tactical Triggers
- **Primary Cyber Action:** Background in `rgba(0, 245, 255, 0.12)`, 1px border in `#00f5ff`, text in `#00f5ff`. On hover, background shifts to `#00f5ff`, text inverts to `#060911`, accompanied by a `0 0 14px rgba(0, 245, 255, 0.5)` outer photonic bloom. Chamfered top-right corner.
- **Destructive / Hazard Button:** Background in `rgba(255, 87, 34, 0.12)`, 1px border in `#ff5722`, text in `#ff5722`. Hover fills with `#ff5722` and black text.
- **Ghost HUD Button:** Transparent background, `rgba(255, 255, 255, 0.12)` border, monospace telemetry typography, subtle hover edge brightening.

### Telemetry Chips & AST Node Tags
- Height: 20px to 24px. Monospace text (`JetBrains Mono`, 11px uppercase).
- States:
  - *Normal:* `rgba(0, 245, 255, 0.08)` fill, cyan outline, leading micro-dot indicator.
  - *Async:* `rgba(139, 92, 246, 0.15)` fill, violet outline.
  - *Hazard Hotspot:* `rgba(245, 158, 11, 0.15)` fill, amber outline, pulsing dot.

### Language Switcher (EN / ES)
- Segmented dual-state toggle with monospaced abbreviations `[ EN ]` and `[ ES ]`.
- Active language is highlighted with an electric cyan glass fill and subtle scanline sweep effect, while the inactive state remains muted (`#64748b`).

### Inputs & Command Palette
- Obsidian field fill (`#0a0f1d`) with 1px border in `rgba(0, 245, 255, 0.25)`.
- Prefixed with terminal command prompt indicators (`>`, `$`, or spatial locator icons).
- Focused state initiates a full cyan border illumination and subtle inner gradient scanline. Monospace caret flashes with cyan phosphor decay.

### Cards & 3D Node Metric Panels
- Frosted dark obsidian slate with outer 1px hairline border.
- Corner crosshairs (`+`) at top-left and bottom-right edges.
- Header integrates micro-telemetry coordinates (e.g., `LOC: 42.11 // AST_DEPTH: 07`).
- Status dividers are styled as segmented dashed rules (`border-top: 1px dashed rgba(0, 245, 255, 0.2)`).

### Selection Controls (Checkboxes & Radios)
- Square (4px radius or 45-degree chamfered) tactical check boxes with diamond center indicators on checked state.
- Radios feature concentric hexagonal or octagonal inner targets rather than generic circular bullets.