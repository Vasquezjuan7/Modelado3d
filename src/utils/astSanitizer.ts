export function sanitizeToken(input: string): string { return input.replace(/<[^>]*>?/gm, ''); }
