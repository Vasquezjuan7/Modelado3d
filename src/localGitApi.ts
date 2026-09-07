import type { FileNode } from './githubApi';
import { computePositions } from './githubApi';

// Type definitions to satisfy TypeScript since we use window.require
declare global {
  interface Window {
    require: any;
  }
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

export async function cloneRepo(url: string, destPath: string, onProgress?: (msg: string) => void): Promise<void> {
  const { exec } = window.require('child_process');
  const fs = window.require('fs');

  return new Promise((resolve, reject) => {
    // If it exists, remove it first (for simplicity in prototyping)
    if (fs.existsSync(destPath)) {
      onProgress?.('Cleaning up old repository...');
      try {
        fs.rmSync(destPath, { recursive: true, force: true });
      } catch (e) {
        console.warn('Failed to remove old repo, continuing...', e);
      }
    }

    onProgress?.(`Cloning ${url} ...`);
    
    exec(`git clone --depth 1 ${url} "${destPath}"`, (error: any, stdout: string, stderr: string) => {
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

export async function parseLocalRepo(rootDir: string): Promise<{ root: FileNode, flatNodes: Map<string, FileNode> }> {
  const fs = window.require('fs');
  const path = window.require('path');
  const flatNodes = new Map<string, FileNode>();

  function walkDir(currentPath: string, parentPathStr: string): FileNode | null {
    const name = path.basename(currentPath);
    
    // Ignore .git folder to save massive amounts of parsing
    if (name === '.git' || name === 'node_modules') return null;

    const stats = fs.statSync(currentPath);
    const isDir = stats.isDirectory();
    const relativePath = parentPathStr ? `${parentPathStr}/${name}` : name;

    const node: FileNode = {
      id: currentPath, // Use absolute path as ID so we can read/write it later
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
  rootNode.name = path.basename(rootDir); // Ensure root has a name

  // Compute 3D positions
  computePositions(rootNode, [0, 0, 0], 2);

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
