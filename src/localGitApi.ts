import type { FileNode } from './githubApi';
import { computePositions } from './githubApi';

// Type definitions to satisfy TypeScript since we use window.require
declare global {
  interface Window {
    require: any;
  }
}

export const getExtensionColor = (ext?: string): string => {
  switch(ext?.toLowerCase()) {
    case 'ts': case 'tsx': return '#00dce5'; // Cyan
    case 'js': case 'jsx': return '#f59e0b'; // Amber
    case 'py': return '#3b82f6'; // Python Blue
    case 'java': return '#ea580c'; // Java Orange
    case 'go': return '#06b6d4'; // Go Teal
    case 'rs': return '#f97316'; // Rust Orange
    case 'html': return '#ef4444'; // HTML Red
    case 'css': return '#a855f7'; // CSS Purple
    case 'json': return '#64748b'; // Slate
    case 'sql': return '#10b981'; // Emerald
    case 'md': return '#94a3b8'; // Light Slate
    default: return '#38bdf8'; // Sky Blue
  }
};

function getExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

export async function cloneRepo(url: string, destPath: string, onProgress?: (msg: string) => void): Promise<void> {
  const { exec } = window.require('child_process');
  const fs = window.require('fs');

  return new Promise((resolve, reject) => {
    if (fs.existsSync(destPath)) {
      onProgress?.('Cleaning up old repository...');
      try {
        fs.rmSync(destPath, { recursive: true, force: true });
      } catch (e) {
        console.warn('Failed to remove old repo, continuing...', e);
      }
    }

    onProgress?.(`Cloning ${url} ...`);
    
    exec(`git clone --depth 1 ${url} "${destPath}"`, (error: any, _stdout: string, stderr: string) => {
      if (error) {
        console.error('Clone error:', stderr);
        reject(new Error(`Git clone failed: ${stderr || error.message}`));
        return;
      }
      onProgress?.('Clone complete!');
      resolve();
    });
  });
}

export async function parseLocalRepo(rootDir: string): Promise<{ root: FileNode; flatNodes: Map<string, FileNode> }> {
  const fs = window.require('fs');
  const path = window.require('path');
  const flatNodes = new Map<string, FileNode>();

  function walkDir(currentPath: string, parentPathStr: string): FileNode | null {
    const name = path.basename(currentPath);
    
    // Ignore .git and node_modules folders
    if (name === '.git' || name === 'node_modules' || name === 'dist' || name === 'build') return null;

    const stats = fs.statSync(currentPath);
    const isDir = stats.isDirectory();
    const relativePath = parentPathStr ? `${parentPathStr}/${name}` : name;

    const node: FileNode = {
      id: currentPath,
      name: name,
      type: isDir ? 'tree' : 'blob',
      path: relativePath,
      size: stats.size,
      extension: isDir ? undefined : getExtension(name),
      children: isDir ? [] : undefined
    };

    flatNodes.set(node.id, node);

    if (isDir) {
      const childrenNames = fs.readdirSync(currentPath);
      for (const childName of childrenNames) {
        const childNode = walkDir(path.join(currentPath, childName), relativePath);
        if (childNode) {
          node.children!.push(childNode);
        }
      }
    }

    return node;
  }

  const rootNode = walkDir(rootDir, '')!;
  rootNode.name = path.basename(rootDir);

  computePositions(rootNode);

  return { root: rootNode, flatNodes };
}

export function readFileContent(filePath: string): string {
  const fs = window.require('fs');
  return fs.readFileSync(filePath, 'utf-8');
}

export function writeFileContent(filePath: string, content: string): void {
  const fs = window.require('fs');
  fs.writeFileSync(filePath, content, 'utf-8');
}