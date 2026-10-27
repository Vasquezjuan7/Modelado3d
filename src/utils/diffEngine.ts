export function computeLineDiff(oldText: string, newText: string): { oldLines: string[]; newLines: string[] } { return { oldLines: oldText.split('\n'), newLines: newText.split('\n') }; }
