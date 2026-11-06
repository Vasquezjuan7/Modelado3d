// Line-based diff (LCS) used by the audit side-by-side view

export interface DiffRow {
  kind: 'same' | 'add' | 'del' | 'change';
  left?: { n: number; text: string };
  right?: { n: number; text: string };
}

export interface DiffResult {
  rows: DiffRow[];
  added: number;
  removed: number;
}

export function diffLines(a: string, b: string): DiffResult {
  const A = a.split(/\r?\n/);
  const B = b.split(/\r?\n/);

  let start = 0;
  while (start < A.length && start < B.length && A[start] === B[start]) start++;
  let endA = A.length - 1;
  let endB = B.length - 1;
  while (endA >= start && endB >= start && A[endA] === B[endB]) {
    endA--;
    endB--;
  }

  const midA = A.slice(start, endA + 1);
  const midB = B.slice(start, endB + 1);
  const ops: Array<{ t: 'same' | 'add' | 'del'; ai?: number; bi?: number }> = [];

  for (let i = 0; i < start; i++) ops.push({ t: 'same', ai: i, bi: i });

  const n = midA.length;
  const m = midB.length;
  if (n * m <= 16_000_000) {
    const W = m + 1;
    const dp = new Uint32Array((n + 1) * W);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i * W + j] = midA[i] === midB[j] ? dp[(i + 1) * W + j + 1] + 1 : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (midA[i] === midB[j]) {
        ops.push({ t: 'same', ai: start + i, bi: start + j });
        i++;
        j++;
      } else if (dp[(i + 1) * W + j] >= dp[i * W + j + 1]) {
        ops.push({ t: 'del', ai: start + i++ });
      } else {
        ops.push({ t: 'add', bi: start + j++ });
      }
    }
    while (i < n) ops.push({ t: 'del', ai: start + i++ });
    while (j < m) ops.push({ t: 'add', bi: start + j++ });
  } else {
    for (let i = 0; i < n; i++) ops.push({ t: 'del', ai: start + i });
    for (let j = 0; j < m; j++) ops.push({ t: 'add', bi: start + j });
  }

  for (let k = 0; k < A.length - 1 - endA; k++) ops.push({ t: 'same', ai: endA + 1 + k, bi: endB + 1 + k });

  // Pair consecutive del/add runs into "change" rows for a side-by-side view
  const rows: DiffRow[] = [];
  let added = 0;
  let removed = 0;
  let k = 0;
  while (k < ops.length) {
    const op = ops[k];
    if (op.t === 'same') {
      rows.push({ kind: 'same', left: { n: op.ai! + 1, text: A[op.ai!] }, right: { n: op.bi! + 1, text: B[op.bi!] } });
      k++;
      continue;
    }
    const dels: number[] = [];
    const adds: number[] = [];
    while (k < ops.length && ops[k].t !== 'same') {
      if (ops[k].t === 'del') dels.push(ops[k].ai!);
      else adds.push(ops[k].bi!);
      k++;
    }
    removed += dels.length;
    added += adds.length;
    const len = Math.max(dels.length, adds.length);
    for (let x = 0; x < len; x++) {
      const l = dels[x];
      const r = adds[x];
      rows.push({
        kind: l !== undefined && r !== undefined ? 'change' : l !== undefined ? 'del' : 'add',
        left: l !== undefined ? { n: l + 1, text: A[l] } : undefined,
        right: r !== undefined ? { n: r + 1, text: B[r] } : undefined,
      });
    }
  }
  return { rows, added, removed };
}
