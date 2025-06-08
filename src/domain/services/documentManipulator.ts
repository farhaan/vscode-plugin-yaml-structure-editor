import * as YAML from 'yaml';
import { YAMLDocument, FieldUpdate, YAMLNodeType } from '../entities';
import { PathResolverService } from './pathResolver';

export class DocumentManipulatorService {
  constructor(private pathResolver: PathResolverService) {}

  applyUpdate(document: YAMLDocument, update: FieldUpdate): YAMLDocument {
    console.log('DocumentManipulator: Applying update', update);
    
    try {
      // Parse the current document content
      const doc = YAML.parseDocument(document.content);
      console.log('Parsed YAML doc for update');
      
      // Configure document to use block format for collections
      if (doc.contents) {
        this.setBlockFormat(doc.contents);
      }
      
      const path = this.pathResolver.parsePath(update.path);
      console.log('Parsed path:', path);
      
      switch (update.operation) {
        case 'update':
          this.updateValue(doc, path, update.value, update.type);
          break;
        case 'add':
          this.addField(doc, path, update.value, update.type);
          break;
        case 'delete':
          this.deleteField(doc, path);
          break;
      }

      // Ensure all new collections use block format
      if (doc.contents) {
        this.setBlockFormat(doc.contents);
      }

      // Convert back to string with block formatting preferences
      const newContent = doc.toString({
        indent: 2,
        lineWidth: 80,
        minContentWidth: 20,
        doubleQuotedAsJSON: false,
        simpleKeys: true
      });
      
      console.log('New YAML content:', newContent);
      
      return {
        content: newContent,
        filePath: document.filePath,
        root: document.root
      };
      
    } catch (error) {
      console.error('DocumentManipulator error:', error);
      throw new Error(`Failed to apply update: ${error}`);
    }
  }

  private setBlockFormat(node: any): void {
    if (YAML.isMap(node)) {
      (node as YAML.YAMLMap).flow = false;
      for (const item of (node as YAML.YAMLMap).items) {
        if (item.value) {
          this.setBlockFormat(item.value);
        }
      }
    } else if (YAML.isSeq(node)) {
      (node as YAML.YAMLSeq).flow = false;
      for (const item of (node as YAML.YAMLSeq).items) {
        this.setBlockFormat(item);
      }
    }
  }

  private updateValue(doc: YAML.Document, path: any, value: any, type: YAMLNodeType): void {
    console.log('Updating value with path:', path, 'value:', value, 'type:', type);
    
    if (path.segments.length === 1 && path.segments[0] === 'root') {
      // Updating root - replace entire document
      const convertedValue = this.convertValue(value, type);
      doc.contents = convertedValue;
      if (convertedValue) this.setBlockFormat(doc.contents);
      return;
    }
    
    const filteredSegments = path.segments.filter((s: string) => s !== 'root');
    const parentSegments = filteredSegments.slice(0, -1);
    const key = filteredSegments[filteredSegments.length - 1];
    
    console.log('Parent segments:', parentSegments, 'Key:', key);
    
    let current: any = doc.contents;
    
    // Navigate to parent
    for (const segment of parentSegments) {
      if (segment.startsWith('[') && segment.endsWith(']')) {
        const index = parseInt(segment.slice(1, -1));
        if (YAML.isSeq(current) && index >= 0 && index < current.items.length) {
          current = current.items[index];
        } else {
          throw new Error(`Invalid array index: ${segment}`);
        }
      } else {
        if (YAML.isMap(current)) {
          current = current.get(segment);
          if (current === undefined) {
            throw new Error(`Key not found: ${segment}`);
          }
          if (YAML.isMap(current)) {
            (current as YAML.YAMLMap).flow = false;
          } else if (YAML.isSeq(current)) {
            (current as YAML.YAMLSeq).flow = false;
          }
        } else {
          throw new Error(`Cannot navigate to ${segment} - current node is not a map`);
        }
      }
    }
    
    // Update the value
    const convertedValue = this.convertValue(value, type);
    
    if (key.startsWith('[') && key.endsWith(']')) {
      // Array index update
      const index = parseInt(key.slice(1, -1));
      if (YAML.isSeq(current) && index >= 0 && index < current.items.length) {
        (current as YAML.YAMLSeq).items[index] = convertedValue;
        (current as YAML.YAMLSeq).flow = false;
        if (convertedValue) this.setBlockFormat(convertedValue);
      } else {
        throw new Error(`Invalid array index for update: ${key}`);
      }
    } else {
      // Object property update
      if (YAML.isMap(current)) {
        (current as YAML.YAMLMap).set(key, convertedValue);
        (current as YAML.YAMLMap).flow = false;
        if (convertedValue) this.setBlockFormat(convertedValue);
      } else {
        throw new Error(`Cannot set property ${key} - current node is not a map`);
      }
    }
  }

  private addField(doc: YAML.Document, path: any, value: any, type: YAMLNodeType): void {
    console.log('Adding field with path:', path, 'value:', value, 'type:', type);
    
    // Handle the case where path doesn't start with 'root' or is just a field name
    let targetSegments = path.segments;
    
    // If the path is just a single segment (field name), add it to root
    if (targetSegments.length === 1 && targetSegments[0] !== 'root') {
      console.log('Single segment path, adding to root level');
      const key = targetSegments[0];
      const convertedValue = this.convertValue(value, type);
      
      // Ensure we have a root map
      if (!YAML.isMap(doc.contents)) {
        console.log('Creating new root map');
        doc.contents = new YAML.YAMLMap();
        (doc.contents as YAML.YAMLMap).flow = false;
      }
      
      (doc.contents as YAML.YAMLMap).set(key, convertedValue);
      (doc.contents as YAML.YAMLMap).flow = false;
      if (convertedValue) this.setBlockFormat(convertedValue);
      console.log('Added field to root map:', key, '=', convertedValue);
      return;
    }
    
    // Handle multi-segment paths that don't start with 'root'
    if (targetSegments.length > 0 && targetSegments[0] !== 'root') {
      console.log('Multi-segment path without root prefix, adding root prefix');
      targetSegments = ['root', ...targetSegments];
    }
    
    // Filter out 'root' segment for processing
    const filteredSegments = targetSegments.filter((s: string) => s !== 'root');
    
    if (filteredSegments.length === 0) {
      throw new Error('Cannot add field: invalid path');
    }
    
    // Check if we're adding to an array (using special append marker)
    const lastSegment = filteredSegments[filteredSegments.length - 1];
    const isArrayAddition = lastSegment === '__append__';
    
    let parentSegments: string[];
    let key: string;
    
    if (isArrayAddition) {
      // For array addition, remove the __append__ marker and use all remaining segments as parent
      parentSegments = filteredSegments.slice(0, -1);
      key = '__append__'; // Special marker for array append
      console.log('Array addition detected, parent segments:', parentSegments);
    } else {
      // For object addition, last segment is the key
      parentSegments = filteredSegments.slice(0, -1);
      key = filteredSegments[filteredSegments.length - 1];
      console.log('Object addition, parent segments:', parentSegments, 'Key:', key);
    }
    
    // Start from root
    let current: any = doc.contents;
    
    // Ensure we have a root map for object additions
    if (!isArrayAddition && !YAML.isMap(current)) {
      console.log('Creating new root map for complex path');
      current = new YAML.YAMLMap();
      (current as YAML.YAMLMap).flow = false;
      doc.contents = current;
    }
    
    // Navigate to target location
    for (let i = 0; i < parentSegments.length; i++) {
      const segment = parentSegments[i];
      
      if (segment.startsWith('[') && segment.endsWith(']')) {
        // Array index navigation
        const index = parseInt(segment.slice(1, -1));
        if (YAML.isSeq(current)) {
          if (index >= 0 && index < current.items.length) {
            current = current.items[index];
          } else {
            throw new Error(`Invalid array index: ${segment}`);
          }
        } else {
          throw new Error(`Cannot navigate array index ${segment} - current node is not an array`);
        }
      } else {
        // Object property navigation
        if (YAML.isMap(current)) {
          let next = current.get(segment);
          if (next === undefined) {
            // Create intermediate object
            console.log('Creating intermediate object for segment:', segment);
            next = new YAML.YAMLMap();
            (next as YAML.YAMLMap).flow = false;
            (current as YAML.YAMLMap).set(segment, next);
          } else {
            // Ensure existing objects use block format
            if (YAML.isMap(next)) {
              (next as YAML.YAMLMap).flow = false;
            } else if (YAML.isSeq(next)) {
              (next as YAML.YAMLSeq).flow = false;
            }
          }
          current = next;
        } else {
          throw new Error(`Cannot navigate to ${segment} - current node is not a map (it's ${typeof current})`);
        }
      }
    }
    
    // Add the new field
    const convertedValue = this.convertValue(value, type);
    
    if (isArrayAddition || key === '__append__') {
      // Array addition - append to the array
      if (!YAML.isSeq(current)) {
        throw new Error(`Cannot add to array - target node is not an array (it's ${YAML.isMap(current) ? 'object' : typeof current})`);
      }
      (current as YAML.YAMLSeq).items.push(convertedValue);
      (current as YAML.YAMLSeq).flow = false;
      if (convertedValue) this.setBlockFormat(convertedValue);
      console.log('Added element to array:', convertedValue);
    } else {
      // Object property addition
      if (!YAML.isMap(current)) {
        throw new Error(`Cannot add field ${key} - target is not an object (it's ${YAML.isSeq(current) ? 'array' : typeof current})`);
      }
      
      // Check if key already exists
      if (current.has(key)) {
        throw new Error(`Field ${key} already exists. Use update operation instead.`);
      }
      
      (current as YAML.YAMLMap).set(key, convertedValue);
      (current as YAML.YAMLMap).flow = false;
      if (convertedValue) this.setBlockFormat(convertedValue);
      console.log('Added field to object:', key, '=', convertedValue);
    }
  }

  private deleteField(doc: YAML.Document, path: any): void {
    console.log('Deleting field with path:', path);
    
    const filteredSegments = path.segments.filter((s: string) => s !== 'root');
    if (filteredSegments.length === 0) {
      throw new Error('Cannot delete root');
    }
    
    const parentSegments = filteredSegments.slice(0, -1);
    const key = filteredSegments[filteredSegments.length - 1];
    
    let current: any = doc.contents;
    
    // Navigate to parent
    for (const segment of parentSegments) {
      if (segment.startsWith('[') && segment.endsWith(']')) {
        const index = parseInt(segment.slice(1, -1));
        if (YAML.isSeq(current) && index >= 0 && index < current.items.length) {
          current = current.items[index];
        } else {
          throw new Error(`Invalid array index: ${segment}`);
        }
      } else {
        if (YAML.isMap(current)) {
          current = current.get(segment);
          if (current === undefined) {
            throw new Error(`Key not found: ${segment}`);
          }
        } else {
          throw new Error(`Cannot navigate to ${segment} - current node is not a map`);
        }
      }
    }
    
    // Delete the field
    if (key.startsWith('[') && key.endsWith(']')) {
      // Array index deletion
      const index = parseInt(key.slice(1, -1));
      if (YAML.isSeq(current) && index >= 0 && index < current.items.length) {
        current.items.splice(index, 1);
      } else {
        throw new Error(`Invalid array index for deletion: ${key}`);
      }
    } else {
      // Object property deletion
      if (YAML.isMap(current)) {
        if (!current.has(key)) {
          throw new Error(`Field ${key} does not exist`);
        }
        current.delete(key);
      } else {
        throw new Error(`Cannot delete property ${key} - current node is not a map`);
      }
    }
  }

  private convertValue(value: any, type: YAMLNodeType): any {
    console.log('Converting value:', value, 'to type:', type);
    
    switch (type) {
      case YAMLNodeType.STRING:
        return String(value);
        
      case YAMLNodeType.NUMBER:
        const num = Number(value);
        if (isNaN(num)) {
          throw new Error(`Invalid number: ${value}`);
        }
        return num;
        
      case YAMLNodeType.BOOLEAN:
        if (typeof value === 'string') {
          const lower = value.toLowerCase();
          if (lower === 'true') return true;
          if (lower === 'false') return false;
          throw new Error(`Invalid boolean: ${value}`);
        }
        return Boolean(value);
        
      case YAMLNodeType.NULL:
        return null;
        
      case YAMLNodeType.ARRAY:
        try {
          let arrayValue;
          if (Array.isArray(value)) {
            arrayValue = value;
          } else if (typeof value === 'string') {
            if (value.trim() === '' || value === '[]') {
              arrayValue = [];
            } else {
              arrayValue = JSON.parse(value);
            }
          } else {
            arrayValue = [];
          }
          
          const yamlSeq = new YAML.YAMLSeq();
          (yamlSeq as YAML.YAMLSeq).flow = false;
          (yamlSeq as YAML.YAMLSeq).items = arrayValue.map((item: any) => item);
          return yamlSeq;
        } catch (error) {
          console.warn('Failed to parse array value, creating empty array:', error);
          const yamlSeq = new YAML.YAMLSeq();
          (yamlSeq as YAML.YAMLSeq).flow = false;
          return yamlSeq;
        }
        
      case YAMLNodeType.OBJECT:
        try {
          let objValue;
          if (typeof value === 'object' && value !== null) {
            objValue = value;
          } else if (typeof value === 'string') {
            if (value.trim() === '' || value === '{}') {
              objValue = {};
            } else {
              objValue = JSON.parse(value);
            }
          } else {
            objValue = {};
          }
          
          const yamlMap = new YAML.YAMLMap();
          (yamlMap as YAML.YAMLMap).flow = false;
          
          // Add properties to the map
          for (const [key, val] of Object.entries(objValue)) {
            (yamlMap as YAML.YAMLMap).set(key, val);
          }
          return yamlMap;
        } catch (error) {
          console.warn('Failed to parse object value, creating empty object:', error);
          const yamlMap = new YAML.YAMLMap();
          (yamlMap as YAML.YAMLMap).flow = false;
          return yamlMap;
        }
        
      default:
        return value;
    }
  }
}