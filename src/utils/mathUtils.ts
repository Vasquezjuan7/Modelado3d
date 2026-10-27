export function clamp(val: number, min: number, max: number): number { return Math.max(min, Math.min(max, val)); }
export function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
