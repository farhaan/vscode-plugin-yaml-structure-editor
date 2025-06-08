import * as YAML from 'yaml';
import { YAMLDocument, YAMLNode, YAMLNodeType } from '../entities';

export class YAMLParserService {
  
  parse(content: string, filePath: string): YAMLDocument {
    try {
      // Parse with options to preserve source locations
      const doc = YAML.parseDocument(content, {
        keepSourceTokens: true
      });
      
      if (doc.errors && doc.errors.length > 0) {
        throw new Error(`YAML parse errors: ${doc.errors.map(e => e.message).join(', ')}`);
      }

      // Create root node and parse the document
      const root = this.parseNode(doc.contents, '__root__');
      
      // Post-process to add line numbers based on content analysis
      this.addLineNumbers(root, content);
      
      return {
        content,
        filePath,
        root
      };
    } catch (error) {
      console.error('YAML parsing error:', error);
      throw new Error(`Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private parseNode(node: any, key: string, parent?: YAMLNode, parentPath?: string): YAMLNode {
    const path = parentPath ? `${parentPath}.${key}` : key === '__root__' ? 'root' : `root.${key}`;
    
    // Get line number if available from YAML source tokens
    let line: number | undefined;
    if (node && typeof node === 'object') {
      try {
        if ('range' in node && Array.isArray(node.range) && node.range.length > 0) {
          line = node.range[0];
        } else if ('srcToken' in node && node.srcToken && 'offset' in node.srcToken) {
          line = node.srcToken.offset;
        }
      } catch (error) {
        // Ignore errors in extracting line numbers from source tokens
      }
    }
    
    const yamlNode: YAMLNode = {
      key,
      path,
      type: this.getNodeType(node),
      value: this.getNodeValue(node),
      children: [],
      parent,
      line
    };

    // Handle children based on node type
    if (node && typeof node === 'object') {
      if (YAML.isMap(node)) {
        yamlNode.type = YAMLNodeType.OBJECT;
        yamlNode.value = {};
        
        for (const item of node.items) {
          if (item && item.key !== undefined && item.value !== undefined) {
            // Safely extract the key
            let childKey: string;
            if (typeof item.key === 'string') {
              childKey = item.key;
            } else if (item.key && typeof item.key === 'object' && 'value' in item.key) {
              childKey = String(item.key.value);
            } else {
              childKey = String(item.key);
            }
            
            const child = this.parseNode(item.value, childKey, yamlNode, path);
            
            // Try to get line number from the key or value
            try {
              if (item.key && typeof item.key === 'object' && 'range' in item.key && Array.isArray(item.key.range)) {
                child.line = item.key.range[0];
              } else if (item.value && typeof item.value === 'object' && 'range' in item.value && Array.isArray(item.value.range)) {
                child.line = item.value.range[0];
              }
            } catch (error) {
              // Ignore line number extraction errors
            }
            
            yamlNode.children!.push(child);
            (yamlNode.value as any)[childKey] = child.value;
          }
        }
      } else if (YAML.isSeq(node)) {
        yamlNode.type = YAMLNodeType.ARRAY;
        yamlNode.value = [];
        
        node.items.forEach((item: any, index: number) => {
          const child = this.parseNode(item, `[${index}]`, yamlNode, path);
          
          // Try to get line number from the item
          try {
            if (item && typeof item === 'object' && 'range' in item && Array.isArray(item.range)) {
              child.line = item.range[0];
            }
          } catch (error) {
            // Ignore line number extraction errors
          }
          
          yamlNode.children!.push(child);
          (yamlNode.value as any[]).push(child.value);
        });
      } else if (YAML.isScalar(node)) {
        yamlNode.value = node.value;
        yamlNode.type = this.getScalarType(node.value);
        
        // Get line number for scalar values
        try {
          if ('range' in node && Array.isArray(node.range)) {
            yamlNode.line = node.range[0];
          }
        } catch (error) {
          // Ignore line number extraction errors
        }
      }
    } else {
      // Simple value
      yamlNode.value = node;
      yamlNode.type = this.getScalarType(node);
    }

    return yamlNode;
  }

  private addLineNumbers(node: YAMLNode, content: string): void {
    const lines = content.split('\n');
    
    // First pass: convert range offsets to line numbers for nodes that have them
    this.convertOffsetsToLineNumbers(node, content);
    
    // Second pass: fill in missing line numbers by searching content
    this.inferLineNumbers(node, lines);
  }

  private convertOffsetsToLineNumbers(node: YAMLNode, content: string): void {
    if (node.line !== undefined && node.line >= 0) {
      // Convert offset to line number
      const beforeOffset = content.substring(0, node.line);
      node.line = beforeOffset.split('\n').length - 1;
    }
    
    if (node.children) {
      node.children.forEach(child => this.convertOffsetsToLineNumbers(child, content));
    }
  }

  private inferLineNumbers(node: YAMLNode, lines: string[]): void {
    // If this node already has a line number, use it as the starting point
    let searchStartLine = node.line !== undefined ? node.line : 0;
    
    // If line number is still undefined, try to find it by searching for the key
    if (node.line === undefined && node.key && node.key !== '__root__') {
      const foundLine = this.findKeyInLines(node.key, lines, searchStartLine);
      if (foundLine !== -1) {
        node.line = foundLine;
        searchStartLine = foundLine;
      }
    }
    
    // Process children
    if (node.children && node.children.length > 0) {
      let currentLine = searchStartLine;
      
      for (const child of node.children) {
        // If child doesn't have a line number, try to find it
        if (child.line === undefined && child.key) {
          const foundLine = this.findKeyInLines(child.key, lines, currentLine);
          if (foundLine !== -1) {
            child.line = foundLine;
            currentLine = foundLine;
          } else {
            // Estimate line number based on current position
            child.line = currentLine;
          }
        } else if (child.line !== undefined) {
          currentLine = Math.max(currentLine, child.line);
        }
        
        // Recursively process child
        this.inferLineNumbers(child, lines);
        
        // Update current line for next iteration
        if (child.line !== undefined) {
          currentLine = Math.max(currentLine, child.line + 1);
        }
      }
    }
  }

  private findKeyInLines(key: string, lines: string[], startLine: number = 0): number {
    // Handle array indices
    if (key.startsWith('[') && key.endsWith(']')) {
      // Look for array item patterns (lines starting with '- ')
      for (let i = startLine; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('- ')) {
          return i;
        }
      }
      return -1;
    }
    
    // Handle object keys
    try {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const keyPattern = new RegExp(`^\\s*${escapedKey}\\s*:`);
      
      for (let i = startLine; i < lines.length; i++) {
        const line = lines[i];
        if (keyPattern.test(line)) {
          return i;
        }
      }
    } catch (regexError) {
      // If regex fails, try simple string matching
      for (let i = startLine; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes(key + ':')) {
          return i;
        }
      }
    }
    
    return -1;
  }

  private getNodeType(node: any): YAMLNodeType {
    if (node === null || node === undefined) {
      return YAMLNodeType.NULL;
    }

    // Check YAML library types first
    try {
      if (YAML.isMap(node)) {
        return YAMLNodeType.OBJECT;
      }

      if (YAML.isSeq(node)) {
        return YAMLNodeType.ARRAY;
      }

      if (YAML.isScalar(node)) {
        return this.getScalarType(node.value);
      }
    } catch (error) {
      // If YAML type checking fails, fall back to JavaScript types
      console.warn('YAML type checking failed, falling back to JS types:', error);
    }

    // For plain JavaScript values
    return this.getScalarType(node);
  }

  private getScalarType(value: any): YAMLNodeType {
    if (value === null || value === undefined) {
      return YAMLNodeType.NULL;
    }

    if (typeof value === 'string') {
      return YAMLNodeType.STRING;
    }

    if (typeof value === 'number') {
      return YAMLNodeType.NUMBER;
    }

    if (typeof value === 'boolean') {
      return YAMLNodeType.BOOLEAN;
    }

    if (Array.isArray(value)) {
      return YAMLNodeType.ARRAY;
    }

    if (typeof value === 'object') {
      return YAMLNodeType.OBJECT;
    }

    return YAMLNodeType.STRING; // Default fallback
  }

  private getNodeValue(node: any): any {
    if (node === null || node === undefined) {
      return null;
    }

    // Check if it's a YAML scalar with a value property
    try {
      if (YAML.isScalar(node)) {
        return node.value;
      }

      if (YAML.isMap(node)) {
        return {}; // Will be populated by parseNode
      }

      if (YAML.isSeq(node)) {
        return []; // Will be populated by parseNode
      }
    } catch (error) {
      // If YAML type checking fails, return the node as-is
      console.warn('YAML value extraction failed, using raw value:', error);
    }

    return node;
  }

  validateYAML(content: string): { isValid: boolean; errors: string[] } {
    try {
      const doc = YAML.parseDocument(content);
      
      if (doc.errors && doc.errors.length > 0) {
        return {
          isValid: false,
          errors: doc.errors.map(error => error.message)
        };
      }
      
      return { isValid: true, errors: [] };
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  formatYAML(content: string, options?: any): string {
    try {
      const doc = YAML.parseDocument(content);
      
      if (doc.errors && doc.errors.length > 0) {
        throw new Error(`YAML parse errors: ${doc.errors.map(e => e.message).join(', ')}`);
      }
      
      return doc.toString({
        indent: 2,
        lineWidth: 0,
        minContentWidth: 0,
        ...options
      });
    } catch (error) {
      throw new Error(`Failed to format YAML: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  getDocumentInfo(content: string): { lineCount: number; keyCount: number; depth: number } {
    try {
      const doc = this.parse(content, '');
      
      const countKeys = (node: YAMLNode): number => {
        let count = node.key !== '__root__' ? 1 : 0;
        if (node.children) {
          count += node.children.reduce((sum, child) => sum + countKeys(child), 0);
        }
        return count;
      };
      
      const getDepth = (node: YAMLNode, currentDepth = 0): number => {
        if (!node.children || node.children.length === 0) {
          return currentDepth;
        }
        
        return Math.max(...node.children.map(child => getDepth(child, currentDepth + 1)));
      };
      
      return {
        lineCount: content.split('\n').length,
        keyCount: countKeys(doc.root),
        depth: getDepth(doc.root)
      };
    } catch (error) {
      console.warn('Failed to get document info:', error);
      return { lineCount: 0, keyCount: 0, depth: 0 };
    }
  }
}