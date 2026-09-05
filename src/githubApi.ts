export interface FileNode {
  id: string;
  name: string;
  type: 'tree' | 'blob'; // folder | file
  path: string;
  size?: number; // Size in bytes
  extension?: string;
  children?: FileNode[];
  position?: [number, number, number];
}

export const getExtensionColor = (ext?: string) => {
  switch(ext) {
    case 'ts': case 'tsx': return '#3178c6'; // TypeScript Blue
    case 'js': case 'jsx': return '#f7df1e'; // JavaScript Yellow
    case 'py': return '#3572A5'; // Python Blue
    case 'java': return '#b07219'; // Java Brown/Orange
    case 'go': return '#00ADD8'; // Go Cyan
    case 'rs': return '#dea584'; // Rust
    case 'html': return '#e34c26'; // HTML Orange
    case 'css': return '#563d7c'; // CSS Purple
    case 'json': return '#292929'; // JSON Dark
    case 'md': return '#ffffff'; // Markdown White
    default: return '#00ffff'; // Default Neon Cyan
  }
};

function getExtension(filename: string) {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

export async function fetchGithubRepoTree(owner: string, repo: string, branch: string = 'main') {
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch repo: ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.truncated) {
    console.warn("Repo is too large, tree is truncated.");
  }

  return buildTree(data.tree);
}

function buildTree(flatTree: any[]): FileNode {
  const root: FileNode = {
    id: 'root',
    name: 'root',
    type: 'tree',
    path: '',
    children: []
  };

  const pathMap = new Map<string, FileNode>();
  pathMap.set('', root);

  // Filter out massive repos or ignore specific folders like node_modules just in case
  // But GitHub recursive API usually returns everything. We'll render it all.

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
    if (parent && parent.children) {
      parent.children.push(node);
    } else {
      root.children!.push(node); // Fallback to root
    }
  }

  // Remove empty directories to save space
  pruneEmptyDirectories(root);
  
  // Compute positions
  computePositions(root, [0, 0, 0], 2);

  return { root, flatNodes: pathMap };
}

function pruneEmptyDirectories(node: FileNode): boolean {
  if (node.type === 'blob') return true; // Keep files
  if (!node.children) return false;

  node.children = node.children.filter(child => pruneEmptyDirectories(child));
  return node.children.length > 0;
}

export function computePositions(node: FileNode, currentPos: [number, number, number], scale: number) {
  node.position = currentPos;

  if (node.children && node.children.length > 0) {
    // Sort children: folders first, then files
    node.children.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'tree' ? -1 : 1;
    });

    const gridCols = Math.ceil(Math.sqrt(node.children.length));
    node.children.forEach((child, index) => {
      const row = Math.floor(index / gridCols);
      const col = index % gridCols;
      // Spacing based on whether it's a folder or file. Folders need more space.
      const spacing = child.type === 'tree' ? 12 * scale : 2 * scale;
      
      const offsetX = (col - (gridCols - 1) / 2) * spacing;
      const offsetZ = (row - (Math.ceil(node.children.length / gridCols) - 1) / 2) * spacing;
      
      const childPos: [number, number, number] = [
        currentPos[0] + offsetX,
        0, // Y is 0 for base
        currentPos[2] + offsetZ
      ];
      
      // Decrease scale for nested folders, but keep files relatively sized
      const nextScale = child.type === 'tree' ? scale * 0.7 : scale;
      computePositions(child, childPos, nextScale);
    });
  }
}
