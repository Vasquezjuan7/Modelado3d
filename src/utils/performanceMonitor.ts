export function measureFPS(delta: number): number { return delta > 0 ? Math.round(1 / delta) : 60; }
