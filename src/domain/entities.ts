export enum YAMLNodeType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  ARRAY = 'array',
  OBJECT = 'object',
  NULL = 'null'
}

// Path type alias for better type safety
export type YAMLPath = string;

export interface YAMLNode {
  key: string;
  path?: YAMLPath;
  type: YAMLNodeType;
  value: any;
  children?: YAMLNode[];
  parent?: YAMLNode;
  line?: number; // Line number in the original YAML file
}

export interface YAMLDocument {
  content: string;
  filePath: string;
  root: YAMLNode;
}

export interface FieldUpdate {
  path: YAMLPath;
  value: any;
  type: YAMLNodeType;
  operation: 'update' | 'add' | 'delete';
}

export interface ParseError {
  message: string;
  line?: number;
  column?: number;
  offset?: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ParseError[];
  warnings?: string[];
}

export interface DocumentMetadata {
  fileName: string;
  size: number;
  lastModified: Date;
  lineCount: number;
  keyCount: number;
  maxDepth: number;
}

export interface SearchResult {
  node: YAMLNode;
  path: YAMLPath;
  matches: SearchMatch[];
}

export interface SearchMatch {
  type: 'key' | 'value' | 'path';
  text: string;
  startIndex: number;
  endIndex: number;
}

export interface TreeNodeState {
  expanded: boolean;
  selected: boolean;
  visible: boolean;
}

export interface EditorConfiguration {
  indentSize: number;
  useSpaces: boolean;
  autoSave: boolean;
  autoSaveDelay: number;
  showLineNumbers: boolean;
  wordWrap: boolean;
  theme: 'light' | 'dark' | 'auto';
}

export interface HistoryEntry {
  timestamp: Date;
  operation: string;
  path: YAMLPath;
  oldValue: any;
  newValue: any;
  description: string;
}

export interface UndoRedoState {
  canUndo: boolean;
  canRedo: boolean;
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  maxHistorySize: number;
}

// Utility type for node filtering
export type NodeFilter = (node: YAMLNode) => boolean;

// Utility type for node transformation
export type NodeTransformer = (node: YAMLNode) => YAMLNode;

// Common node filters
export const NodeFilters = {
  byType: (type: YAMLNodeType): NodeFilter => (node) => node.type === type,
  byKey: (key: string): NodeFilter => (node) => node.key === key,
  byPath: (path: YAMLPath): NodeFilter => (node) => node.path === path,
  hasChildren: (): NodeFilter => (node) => !!(node.children && node.children.length > 0),
  isLeaf: (): NodeFilter => (node) => !(node.children && node.children.length > 0),
  hasValue: (): NodeFilter => (node) => node.value !== undefined && node.value !== null,
  isEmpty: (): NodeFilter => (node) => node.value === undefined || node.value === null || 
    (typeof node.value === 'string' && node.value.trim() === '') ||
    (Array.isArray(node.value) && node.value.length === 0) ||
    (typeof node.value === 'object' && node.value !== null && Object.keys(node.value).length === 0)
};

// Common node transformers
export const NodeTransformers = {
  updateValue: (newValue: any): NodeTransformer => (node) => ({ ...node, value: newValue }),
  updateType: (newType: YAMLNodeType): NodeTransformer => (node) => ({ ...node, type: newType }),
  updateKey: (newKey: string): NodeTransformer => (node) => ({ ...node, key: newKey }),
  addChild: (child: YAMLNode): NodeTransformer => (node) => ({
    ...node,
    children: [...(node.children || []), child]
  }),
  removeChild: (childKey: string): NodeTransformer => (node) => ({
    ...node,
    children: (node.children || []).filter(child => child.key !== childKey)
  })
};

// Type guards
export const isStringNode = (node: YAMLNode): boolean => node.type === YAMLNodeType.STRING;
export const isNumberNode = (node: YAMLNode): boolean => node.type === YAMLNodeType.NUMBER;
export const isBooleanNode = (node: YAMLNode): boolean => node.type === YAMLNodeType.BOOLEAN;
export const isArrayNode = (node: YAMLNode): boolean => node.type === YAMLNodeType.ARRAY;
export const isObjectNode = (node: YAMLNode): boolean => node.type === YAMLNodeType.OBJECT;
export const isNullNode = (node: YAMLNode): boolean => node.type === YAMLNodeType.NULL;
export const isLeafNode = (node: YAMLNode): boolean => !(node.children && node.children.length > 0);
export const isContainerNode = (node: YAMLNode): boolean => !!(node.children && node.children.length > 0);

// Constants
export const MAX_TREE_DEPTH = 50;
export const MAX_NODE_COUNT = 10000;
export const MAX_VALUE_LENGTH = 10000;
export const DEFAULT_INDENT_SIZE = 2;
export const DEFAULT_AUTO_SAVE_DELAY = 1000;