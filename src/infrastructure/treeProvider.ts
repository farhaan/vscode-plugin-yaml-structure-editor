import * as vscode from 'vscode';
import { YAMLNode, YAMLPath } from '../domain/entities';

export class YAMLTreeProvider implements vscode.TreeDataProvider<YAMLNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<YAMLNode | undefined | null | void> = new vscode.EventEmitter<YAMLNode | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<YAMLNode | undefined | null | void> = this._onDidChangeTreeData.event;

  private rootNode: YAMLNode | null = null;

  constructor() {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  setRootNode(node: YAMLNode): void {
    this.rootNode = node;
    this.refresh();
  }

  getTreeItem(element: YAMLNode): vscode.TreeItem {
    const hasChildren = element.children && element.children.length > 0;
    const collapsibleState = hasChildren ? 
      vscode.TreeItemCollapsibleState.Expanded : 
      vscode.TreeItemCollapsibleState.None;

    const treeItem = new YAMLTreeItem(
      this.getDisplayLabel(element),
      collapsibleState,
      element
    );

    // Set description (showing the value for leaf nodes)
    if (!hasChildren && element.value !== undefined && element.value !== null) {
      treeItem.description = this.formatValue(element.value, element.type);
    }

    // FIX: Set context value based on node TYPE, not just whether it has children
    // This ensures empty arrays still get the correct context menu
    if (element.type === 'array') {
      treeItem.contextValue = 'yamlArray';
    } else if (element.type === 'object' || hasChildren) {
      treeItem.contextValue = 'yamlContainer';
    } else {
      treeItem.contextValue = 'yamlValue';
    }

    // Set appropriate icon based on type
    switch (element.type) {
      case 'array':
        treeItem.iconPath = new vscode.ThemeIcon('symbol-array');
        break;
      case 'object':
        treeItem.iconPath = new vscode.ThemeIcon('symbol-object');
        break;
      case 'string':
        treeItem.iconPath = new vscode.ThemeIcon('symbol-string');
        break;
      case 'number':
        treeItem.iconPath = new vscode.ThemeIcon('symbol-number');
        break;
      case 'boolean':
        treeItem.iconPath = new vscode.ThemeIcon('symbol-boolean');
        break;
      default:
        if (hasChildren) {
          treeItem.iconPath = new vscode.ThemeIcon('folder');
        } else {
          treeItem.iconPath = new vscode.ThemeIcon('symbol-property');
        }
    }

    return treeItem;
  }

  getChildren(element?: YAMLNode): Thenable<YAMLNode[]> {
    if (!this.rootNode) {
      return Promise.resolve([]);
    }

    if (element) {
      return Promise.resolve(element.children || []);
    } else {
      // Return root children or root itself if it has no children
      if (this.rootNode.children && this.rootNode.children.length > 0) {
        return Promise.resolve(this.rootNode.children);
      } else {
        return Promise.resolve([this.rootNode]);
      }
    }
  }

  private getDisplayLabel(node: YAMLNode): string {
    if (node.key === '__root__') {
      return 'YAML Document';
    }
    
    return node.key || `[${node.type}]`;
  }

  private formatValue(value: any, type: string): string {
    if (value === null || value === undefined) {
      return '';
    }

    switch (type) {
      case 'string':
        const strValue = String(value);
        return strValue.length > 30 ? strValue.substring(0, 27) + '...' : strValue;
      case 'number':
      case 'boolean':
        return String(value);
      case 'array':
        if (Array.isArray(value)) {
          return value.length === 0 ? '[empty]' : `[${value.length} items]`;
        }
        return '[]';
      case 'object':
        const keys = typeof value === 'object' && value !== null ? Object.keys(value) : [];
        return keys.length === 0 ? '{empty}' : `{${keys.length} keys}`;
      default:
        return String(value);
    }
  }

  getParent(element: YAMLNode): vscode.ProviderResult<YAMLNode> {
    return element.parent;
  }

  resolveTreeItem(item: vscode.TreeItem, element: YAMLNode): vscode.ProviderResult<vscode.TreeItem> {
    return item;
  }
}

export class YAMLTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly yamlNode: YAMLNode
  ) {
    super(label, collapsibleState);
    
    // Add command for clicking on items (for navigation)
    this.command = {
      command: 'yamlUpdater.selectPath',
      title: 'Select Path',
      arguments: [yamlNode.path, yamlNode.value, yamlNode.type]
    };

    // Add inline edit button for leaf nodes (pencil icon)
    const hasChildren = yamlNode.children && yamlNode.children.length > 0;
    if (!hasChildren && yamlNode.type !== 'array' && yamlNode.type !== 'object') {
      this.resourceUri = vscode.Uri.parse(`yaml-node:${yamlNode.path}`);
    }

    // Create comprehensive tooltip
    const pathText = yamlNode.path || 'root';
    const valueText = this.getValuePreview(yamlNode.value, yamlNode.type);
    const lineText = yamlNode.line !== undefined ? ` (Line ${yamlNode.line + 1})` : '';
    
    let actionHint = '';
    if (yamlNode.type === 'array') {
      // Always show array hint, even for empty arrays
      const itemCount = Array.isArray(yamlNode.value) ? yamlNode.value.length : 0;
      if (itemCount === 0) {
        actionHint = '\n🔧 Right-click to add first array item';
      } else {
        actionHint = '\n🔧 Right-click to add array items';
      }
    } else if (yamlNode.type === 'object' || hasChildren) {
      actionHint = '\n🔧 Right-click to add child fields';
    } else {
      actionHint = '\n🔧 Click to edit value';
    }
    
    this.tooltip = `🔗 Path: ${pathText}\n📝 Type: ${yamlNode.type}\n💾 Value: ${valueText}${lineText}${actionHint}`;
  }

  private getValuePreview(value: any, type: string): string {
    if (value === undefined || value === null) {
      return '(empty)';
    }
    
    if (type === 'array') {
      if (Array.isArray(value)) {
        return value.length === 0 ? '[empty array - ready for items]' : `[${value.length} items]`;
      }
      return '[]';
    }
    
    if (type === 'object') {
      const keys = typeof value === 'object' ? Object.keys(value) : [];
      return keys.length === 0 ? '{empty object}' : JSON.stringify(value);
    }
    
    const valueStr = String(value);
    return valueStr.length > 50 ? valueStr.substring(0, 47) + '...' : valueStr;
  }
}