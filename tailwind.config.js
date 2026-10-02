/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      "colors": { "primary-fixed": "#63f7ff", "on-secondary": "#003824", "surface-container": "#1c1f28", "surface-tint": "#00dce5", "outline": "#849495", "tertiary-fixed-dim": "#d0bcff", "surface-container-low": "#181b24", "on-surface-variant": "#b9caca", "surface-bright": "#363942", "secondary-fixed": "#6ffbbe", "on-secondary-container": "#00311f", "surface-variant": "#31353e", "on-error": "#690005", "on-tertiary-fixed": "#23005c", "tertiary-container": "#e5d7ff", "error-container": "#93000a", "surface-dim": "#10131c", "primary": "#e9feff", "tertiary-fixed": "#e9ddff", "background": "#10131c", "inverse-on-surface": "#2d3039", "on-secondary-fixed-variant": "#005236", "inverse-primary": "#00696e", "on-primary-fixed": "#002021", "inverse-surface": "#e0e2ee", "primary-container": "#00f5ff", "on-tertiary-fixed-variant": "#5516be", "outline-variant": "#3a494a", "on-surface": "#e0e2ee", "on-primary-fixed-variant": "#004f53", "on-secondary-fixed": "#002113", "tertiary": "#fef8ff", "surface": "#10131c", "error": "#ffb4ab", "surface-container-lowest": "#0b0e16", "on-tertiary-container": "#703eda", "on-primary-container": "#006c71", "surface-container-highest": "#31353e", "primary-fixed-dim": "#00dce5", "on-error-container": "#ffdad6", "on-primary": "#003739", "secondary": "#4edea3", "on-tertiary": "#3c0091", "surface-container-high": "#262a33", "secondary-fixed-dim": "#4edea3", "secondary-container": "#00a572", "on-background": "#e0e2ee" },
      "borderRadius": { "DEFAULT": "0.125rem", "lg": "0.25rem", "xl": "0.5rem", "full": "0.75rem" },
      "spacing": { "space-sm": "0.5rem", "gutter-lg": "1.5rem", "margin-lg": "2.5rem", "gutter": "1rem", "margin-md": "1.5rem", "space-lg": "1.5rem", "space-md": "1rem", "space-xs": "0.25rem", "margin": "1rem", "space-xl": "2.5rem" },
      "fontFamily": { "headline-lg": ["Space Grotesk"], "body-md": ["Space Grotesk"], "title-sm": ["Space Grotesk"], "body-lg": ["Space Grotesk"], "mono-code": ["JetBrains Mono"], "headline-lg-mobile": ["Space Grotesk"], "display-xl-mobile": ["Space Grotesk"], "headline-md": ["Space Grotesk"], "telemetry-label": ["JetBrains Mono"], "micro-coordinate": ["JetBrains Mono"], "display-xl": ["Space Grotesk"] },
      "fontSize": { "headline-lg": ["32px", { "lineHeight": "40px", "letterSpacing": "-0.02em", "fontWeight": "600" }], "body-md": ["14px", { "lineHeight": "20px", "letterSpacing": "0.01em", "fontWeight": "400" }], "title-sm": ["18px", { "lineHeight": "24px", "letterSpacing": "0em", "fontWeight": "500" }], "body-lg": ["16px", { "lineHeight": "24px", "letterSpacing": "0.01em", "fontWeight": "400" }], "mono-code": ["13px", { "lineHeight": "18px", "letterSpacing": "-0.01em", "fontWeight": "500" }], "headline-lg-mobile": ["24px", { "lineHeight": "32px", "letterSpacing": "-0.01em", "fontWeight": "600" }], "display-xl-mobile": ["32px", { "lineHeight": "40px", "letterSpacing": "-0.02em", "fontWeight": "700" }], "headline-md": ["24px", { "lineHeight": "32px", "letterSpacing": "-0.01em", "fontWeight": "600" }], "telemetry-label": ["11px", { "lineHeight": "14px", "letterSpacing": "0.08em", "fontWeight": "600" }], "micro-coordinate": ["9px", { "lineHeight": "12px", "letterSpacing": "0.12em", "fontWeight": "400" }], "display-xl": ["48px", { "lineHeight": "56px", "letterSpacing": "-0.03em", "fontWeight": "700" }] }
    },
  },
  plugins: [],
}
