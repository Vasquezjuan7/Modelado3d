export interface FileNode {
  id: string;
  name: string;
  type: 'tree' | 'blob';
  path: string;
  size?: number;
  extension?: string;
  children?: FileNode[];
  position?: [number, number, number];
  width?: number;
  depth?: number;
  absolutePosition?: [number, number, number];
}

export const getExtensionColor = (ext?: string): string => {
  switch(ext?.toLowerCase()) {
    case 'ts': case 'tsx': return '#00dce5';
    case 'js': case 'jsx': return '#f59e0b';
    case 'py': return '#3b82f6';
    case 'java': return '#ea580c';
    case 'go': return '#06b6d4';
    case 'rs': return '#f97316';
    case 'html': return '#ef4444';
    case 'css': return '#a855f7';
    case 'json': return '#64748b';
    case 'sql': return '#10b981';
    case 'md': return '#94a3b8';
    default: return '#38bdf8';
  }
};

function getExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

export async function fetchGithubRepoTree(owner: string, repo: string, branch: string = 'main'): Promise<{ root: FileNode; flatNodes: Map<string, FileNode> }> {
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch repo: ${response.statusText}`);
  const data = await response.json();
  return buildTree(data.tree);
}

function buildTree(flatTree: any[]): { root: FileNode; flatNodes: Map<string, FileNode> } {
  const root: FileNode = { id: 'root', name: 'root', type: 'tree', path: '', children: [] };
  const pathMap = new Map<string, FileNode>();
  pathMap.set('', root);

  for (const item of flatTree) {
    const parts = item.path.split('/');
    const name = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join('/');
    
    const node: FileNode = {
      id: item.path,
      name: name,
      type: item.type === 'tree' ? 'tree' : 'blob',
      path: item.path,
      size: item.size || 0,
      extension: item.type === 'blob' ? getExtension(name) : undefined,
      children: item.type === 'tree' ? [] : undefined
    };

    pathMap.set(item.path, node);
    const parent = pathMap.get(parentPath);
    if (parent && parent.children) parent.children.push(node);
    else root.children!.push(node);
  }

  pruneEmptyDirectories(root);
  return { root, flatNodes: pathMap };
}

function pruneEmptyDirectories(node: FileNode): boolean {
  if (node.type === 'blob') return true;
  if (!node.children) return false;
  node.children = node.children.filter(child => pruneEmptyDirectories(child));
  return node.children.length > 0;
}

export function computePositions(node: FileNode) {
  node.position = [0, 0, 0];
  computeAbsolutePositions(node, [0, 0, 0]);
}

export function computeAbsolutePositions(node: FileNode, parentAbsPos: [number, number, number]) {
  const localPos = node.position || [0, 0, 0];
  const absX = parentAbsPos[0] + localPos[0];
  const absY = parentAbsPos[1] + localPos[1];
  const absZ = parentAbsPos[2] + localPos[2];
  
  node.absolutePosition = [absX, absY, absZ];

  if (node.children) {
    node.children.forEach(child => computeAbsolutePositions(child, [absX, absY, absZ]));
  }
}