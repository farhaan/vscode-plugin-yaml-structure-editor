import { YAMLNode, YAMLPath } from '../entities';

export interface ParsedPath {
  segments: string[];
  isValid: boolean;
}

export class PathResolverService {
  
  parsePath(path: YAMLPath): ParsedPath {
    if (!path || typeof path !== 'string') {
      return { segments: [], isValid: false };
    }

    try {
      // Handle simple paths like "root.key1.key2"
      if (path.startsWith('root.')) {
        const segments = path.split('.');
        return { segments, isValid: true };
      }
      
      // Handle root-only path
      if (path === 'root') {
        return { segments: ['root'], isValid: true };
      }
      
      // Handle paths that don't start with root (add root prefix)
      const segments = ['root', ...path.split('.')];
      return { segments, isValid: true };
      
    } catch (error) {
      console.error('Error parsing path:', path, error);
      return { segments: [], isValid: false };
    }
  }

  findNodeByPath(root: YAMLNode | undefined, targetPath: YAMLPath): YAMLNode | null {
    if (!root || !targetPath) {
      return null;
    }

    const searchNode = (node: YAMLNode): YAMLNode | null => {
      // Check if this node matches the target path
      if (node.path === targetPath) {
        return node;
      }
      
      // Search children
      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          const result = searchNode(child);
          if (result) {
            return result;
          }
        }
      }
      
      return null;
    };

    return searchNode(root);
  }

  findNodeByLineNumber(root: YAMLNode | undefined, line: number): YAMLNode | null {
    if (!root) {
      return null;
    }

    const searchNode = (node: YAMLNode): YAMLNode | null => {
      // Check if this node is at the target line
      if (node.line === line) {
        return node;
      }
      
      // If this node has children, search them first (more specific matches)
      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          const result = searchNode(child);
          if (result) {
            return result;
          }
        }
      }
      
      // If line falls within this node's range, return this node
      if (node.line !== undefined && node.line <= line) {
        // Check if we're within a reasonable range (e.g., within 2 lines for multi-line values)
        const nextSiblingLine = this.getNextSiblingLine(node);
        if (nextSiblingLine === null || line < nextSiblingLine) {
          return node;
        }
      }
      
      return null;
    };

    return searchNode(root);
  }

  getNodePath(node: YAMLNode): YAMLPath {
    const pathParts: string[] = [];
    let current: YAMLNode | undefined = node;
    
    while (current && current.key !== '__root__') {
      if (current.key) {
        pathParts.unshift(current.key);
      }
      current = current.parent;
    }
    
    return pathParts.length > 0 ? 'root.' + pathParts.join('.') : 'root';
  }

  private getNextSiblingLine(node: YAMLNode): number | null {
    if (!node.parent || !node.parent.children) {
      return null;
    }
    
    const siblings = node.parent.children;
    const currentIndex = siblings.indexOf(node);
    
    if (currentIndex >= 0 && currentIndex < siblings.length - 1) {
      const nextSibling = siblings[currentIndex + 1];
      return nextSibling.line !== undefined ? nextSibling.line : null;
    }
    
    return null;
  }

  resolveValue(root: YAMLNode, path: YAMLPath): any {
    const parsedPath = this.parsePath(path);
    if (!parsedPath.isValid) {
      return undefined;
    }

    let current: YAMLNode | undefined = root;
    
    // Skip 'root' segment
    const segments = parsedPath.segments.slice(1);
    
    for (const segment of segments) {
      if (!current || !current.children) {
        return undefined;
      }
      
      // Handle array indices like [0], [1], etc.
      if (segment.startsWith('[') && segment.endsWith(']')) {
        const index = parseInt(segment.slice(1, -1));
        if (isNaN(index) || index < 0 || index >= current.children.length) {
          return undefined;
        }
        current = current.children[index];
      } else {
        // Handle object properties
        current = current.children.find(child => child.key === segment);
      }
    }
    
    return current?.value;
  }

  validatePath(root: YAMLNode, path: YAMLPath): boolean {
    const parsedPath = this.parsePath(path);
    if (!parsedPath.isValid) {
      return false;
    }

    try {
      const value = this.resolveValue(root, path);
      return value !== undefined;
    } catch {
      return false;
    }
  }

  getAvailablePaths(root: YAMLNode): YAMLPath[] {
    const paths: YAMLPath[] = [];
    
    const collectPaths = (node: YAMLNode): void => {
      if (node.path && node.path !== 'root') {
        paths.push(node.path);
      }
      
      if (node.children) {
        node.children.forEach(collectPaths);
      }
    };
    
    collectPaths(root);
    return paths;
  }

  getPathDepth(path: YAMLPath): number {
    const parsedPath = this.parsePath(path);
    if (!parsedPath.isValid) {
      return 0;
    }
    
    // Subtract 1 for the 'root' segment
    return Math.max(0, parsedPath.segments.length - 1);
  }

  getParentPath(path: YAMLPath): YAMLPath | null {
    const parsedPath = this.parsePath(path);
    if (!parsedPath.isValid || parsedPath.segments.length <= 1) {
      return null;
    }
    
    const parentSegments = parsedPath.segments.slice(0, -1);
    return parentSegments.join('.');
  }

  getChildPaths(root: YAMLNode, parentPath: YAMLPath): YAMLPath[] {
    const parentNode = this.findNodeByPath(root, parentPath);
    if (!parentNode || !parentNode.children) {
      return [];
    }
    
    return parentNode.children
      .map(child => child.path)
      .filter((path): path is YAMLPath => path !== undefined);
  }
}