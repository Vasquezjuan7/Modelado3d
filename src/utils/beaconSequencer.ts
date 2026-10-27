export function getStrobeIntensity(elapsed: number): number { return Math.pow(Math.sin(elapsed * 4), 8); }
