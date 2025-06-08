import * as vscode from 'vscode';
import { YAMLTreeProvider } from './infrastructure/treeProvider';
import { YAMLEditorWebviewProvider } from './infrastructure/webviewProvider';
import { YAMLParserService } from './domain/services/yamlParser';
import { PathResolverService } from './domain/services/pathResolver';
import { DocumentManipulatorService } from './domain/services/documentManipulator';
import { YAMLDocument, FieldUpdate, YAMLPath, YAMLNode } from './domain/entities';

export function activate(context: vscode.ExtensionContext) {
  console.log('YAML Structure Editor is now active!');
  
  const extension = new YAMLStructureEditor(context);
  extension.initialize();
}

export function deactivate() {}

class YAMLStructureEditor {
  private treeProvider: YAMLTreeProvider;
  private yamlParser: YAMLParserService;
  private pathResolver: PathResolverService;
  private documentManipulator: DocumentManipulatorService;
  private currentDocument: YAMLDocument | null = null;
  private currentWebviewPanel: vscode.WebviewPanel | null = null;
  private webviewDisposed = true;
  private selectedNode: YAMLNode | null = null;
  private cursorContextNode: YAMLNode | null = null;

  constructor(private context: vscode.ExtensionContext) {
    this.yamlParser = new YAMLParserService();
    this.pathResolver = new PathResolverService();
    this.documentManipulator = new DocumentManipulatorService(this.pathResolver);
    this.treeProvider = new YAMLTreeProvider();
  }

  initialize() {
    this.registerCommands();
    this.registerProviders();
    this.registerEventListeners();
    
    // Load active document if it's a YAML file
    if (vscode.window.activeTextEditor && this.isYamlFile(vscode.window.activeTextEditor.document)) {
      this.loadDocument(vscode.window.activeTextEditor.document);
    }
  }

  private registerCommands() {
    const commands = [
      vscode.commands.registerCommand('yamlUpdater.openEditor', () => this.openWebviewEditor()),
      vscode.commands.registerCommand('yamlUpdater.refresh', () => this.refreshView()),
      vscode.commands.registerCommand('yamlUpdater.editField', (path: YAMLPath, value: any, type: string) => {
        this.openWebviewEditor();
        // Send node selection to webview after a short delay to ensure it's loaded
        setTimeout(() => {
          this.selectNode(path, value, type);
        }, 100);
      }),
      // FIX 1: Enhanced selectPath command to also navigate to line in editor
      vscode.commands.registerCommand('yamlUpdater.selectPath', (path: YAMLPath, value: any, type: string) => {
        this.selectNode(path, value, type);
        this.navigateToNodeInEditor(path);
      }),
      vscode.commands.registerCommand('yamlUpdater.selectByPath', (pathString: YAMLPath) => {
        if (this.currentDocument?.root) {
          const node = this.pathResolver.findNodeByPath(this.currentDocument.root, pathString);
          if (node) {
            this.selectNode(node.path, node.value, node.type);
            this.navigateToNodeInEditor(node.path);
          }
        }
      }),
      // FIX 2: Add new commands for adding fields
      vscode.commands.registerCommand('yamlUpdater.addRootField', () => {
        this.addNewField();
      }),
      vscode.commands.registerCommand('yamlUpdater.addContextualField', () => {
        this.addNewField();
      }),
      vscode.commands.registerCommand('yamlUpdater.addArrayItem', () => {
        this.addArrayItem();
      })
    ];

    commands.forEach(command => this.context.subscriptions.push(command));
  }

  private registerProviders() {
    // Register tree data provider
    vscode.window.registerTreeDataProvider('yamlStructure', this.treeProvider);
    
    // Register hover provider for YAML files
    const yamlHoverProvider = vscode.languages.registerHoverProvider(
      ['yaml', 'yml'], 
      {
        provideHover: (document, position) => {
          return this.provideYamlHover(document, position);
        }
      }
    );
    
    this.context.subscriptions.push(yamlHoverProvider);
  }

  private registerEventListeners() {
    // Listen for active editor changes
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && this.isYamlFile(editor.document)) {
        this.loadDocument(editor.document);
      }
    }, null, this.context.subscriptions);

    // Listen for document changes
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (this.isYamlFile(event.document)) {
        // Debounce the update to avoid too frequent parsing
        setTimeout(() => {
          this.loadDocument(event.document);
        }, 500);
      }
    }, null, this.context.subscriptions);

    // Listen for cursor position changes to update context
    vscode.window.onDidChangeTextEditorSelection((event) => {
      if (event.textEditor && this.isYamlFile(event.textEditor.document)) {
        this.updateCursorContext(event.textEditor, event.selections[0]);
      }
    }, null, this.context.subscriptions);
  }

  private provideYamlHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | null {
    if (!this.currentDocument || !this.currentDocument.root || !this.isYamlFile(document)) {
      return null;
    }

    try {
      const line = position.line;
      
      // Find the YAML node at this line
      const node = this.pathResolver.findNodeByLineNumber(this.currentDocument.root, line);
      
      if (!node) {
        return null;
      }

      // Create hover content
      const hoverContent = new vscode.MarkdownString();
      
      // Add YAML path prominently
      hoverContent.appendMarkdown(`**🔗 YAML Path:** \`${node.path || 'root'}\`\n\n`);
      
      // Add node details
      hoverContent.appendMarkdown(`**Key:** ${node.key}  \n`);
      hoverContent.appendMarkdown(`**Type:** ${node.type}  \n`);
      
      if (node.value !== undefined && node.value !== null) {
        const valueStr = typeof node.value === 'object' ? 
          JSON.stringify(node.value, null, 2) : String(node.value);
        const truncatedValue = valueStr.length > 200 ? 
          valueStr.substring(0, 197) + '...' : valueStr;
        hoverContent.appendMarkdown(`**Value:**\n\`\`\`yaml\n${truncatedValue}\n\`\`\`\n`);
      }
      
      if (node.children && node.children.length > 0) {
        hoverContent.appendMarkdown(`**Children:** ${node.children.length} items\n`);
      }
      
      hoverContent.appendMarkdown(`**Line:** ${line + 1}  \n`);
      
      // Add action hint with command link
      hoverContent.appendMarkdown(`\n---\n*💡 [Click to edit this field](command:yamlUpdater.editField?${encodeURIComponent(JSON.stringify([node.path, node.value, node.type]))})*`);
      
      // Make it trusted so markdown renders properly
      hoverContent.isTrusted = true;
      
      return new vscode.Hover(hoverContent);
      
    } catch (error) {
      console.error('Error providing YAML hover:', error);
      return null;
    }
  }

  // FIX 3: Add method to navigate to node in editor
  private navigateToNodeInEditor(path: YAMLPath | undefined) {
    if (!path || !this.currentDocument || !vscode.window.activeTextEditor) {
      return;
    }

    try {
      const node = this.pathResolver.findNodeByPath(this.currentDocument.root, path);
      if (node && node.line !== undefined) {
        const editor = vscode.window.activeTextEditor;
        const line = node.line;
        const position = new vscode.Position(line, 0);
        const range = new vscode.Range(position, position);
        
        // Reveal and select the line
        editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
        editor.selection = new vscode.Selection(position, position);
        
        // Focus the editor
        vscode.window.showTextDocument(editor.document, editor.viewColumn);
      }
    } catch (error) {
      console.error('Error navigating to node in editor:', error);
    }
  }

  // Add method to update cursor context based on current editor position
  private updateCursorContext(editor: vscode.TextEditor, selection: vscode.Selection) {
    if (!this.currentDocument || !this.currentDocument.root) {
      this.cursorContextNode = null;
      return;
    }

    try {
      const line = selection.active.line;
      const contextNode = this.pathResolver.findNodeByLineNumber(this.currentDocument.root, line);
      this.cursorContextNode = contextNode;
      
      // Update webview with new context if it's open
      if (this.currentWebviewPanel && !this.webviewDisposed) {
        this.currentWebviewPanel.webview.postMessage({
          type: 'contextUpdated',
          contextNode: contextNode ? {
            path: contextNode.path,
            key: contextNode.key,
            type: contextNode.type,
            isContainer: !!(contextNode.children && contextNode.children.length > 0)
          } : null
        });
      }
    } catch (error) {
      console.error('Error updating cursor context:', error);
      this.cursorContextNode = null;
    }
  }

  // Get the best context for adding new fields
  private getAdditionContext(): any {
    // Priority: 1. Selected node from tree, 2. Cursor context, 3. Root
    const contextNode = this.selectedNode || this.cursorContextNode;
    
    if (!contextNode) {
      return {
        path: 'root',
        key: 'root',
        type: 'object',
        isContainer: true,
        isArray: false,
        description: 'Add to root level'
      };
    }

    // If the context node is an array (including empty arrays), add as new array item
    if (contextNode.type === 'array') {
      const itemCount = Array.isArray(contextNode.value) ? contextNode.value.length : 0;
      return {
        path: contextNode.path + '.__append__', // Special syntax for array append
        key: contextNode.key,
        type: contextNode.type,
        isContainer: true,
        isArray: true,
        description: itemCount === 0 
          ? `Add first item to empty array "${contextNode.key}"`
          : `Add new item to array "${contextNode.key}" (${itemCount} items)`
      };
    }

    // If the context node is an object (including empty objects), add as child property
    if (contextNode.type === 'object' || (contextNode.children && contextNode.children.length >= 0)) {
      const childCount = contextNode.children ? contextNode.children.length : 0;
      return {
        path: contextNode.path,
        key: contextNode.key,
        type: contextNode.type,
        isContainer: true,
        isArray: false,
        description: childCount === 0
          ? `Add first property to empty object "${contextNode.key}"`
          : `Add as child of "${contextNode.key}" (${childCount} properties)`
      };
    }

    // If it's a leaf node, add as sibling (to parent)
    if (contextNode.parent) {
      // Check if parent is an array
      if (contextNode.parent.type === 'array') {
        const parentItemCount = Array.isArray(contextNode.parent.value) ? contextNode.parent.value.length : 0;
        return {
          path: contextNode.parent.path + '.__append__', // Special syntax for array append
          key: contextNode.parent.key,
          type: contextNode.parent.type,
          isContainer: true,
          isArray: true,
          description: `Add new item to array "${contextNode.parent.key}" (${parentItemCount} items)`
        };
      } else {
        return {
          path: contextNode.parent.path,
          key: contextNode.parent.key,
          type: contextNode.parent.type,
          isContainer: true,
          isArray: false,
          description: `Add as sibling to "${contextNode.key}"`
        };
      }
    }

    // Fallback to root
    return {
      path: 'root',
      key: 'root',
      type: 'object',
      isContainer: true,
      isArray: false,
      description: 'Add to root level'
    };
  }

  // Add method for adding array items specifically
  private async addArrayItem() {
    if (!this.currentDocument) {
      vscode.window.showWarningMessage('Please open a YAML file first.');
      return;
    }

    const context = this.getAdditionContext();
    
    // Ensure we have an array context
    if (!context.isArray) {
      vscode.window.showWarningMessage('Please select an array node first, or use "Add New Field" for object properties.');
      return;
    }

    const itemType = await vscode.window.showQuickPick([
      { label: 'String', value: 'string' },
      { label: 'Number', value: 'number' },
      { label: 'Boolean', value: 'boolean' },
      { label: 'Object', value: 'object' },
      { label: 'Array', value: 'array' },
      { label: 'Null', value: 'null' }
    ], {
      placeHolder: 'Select the type for the new array item'
    });

    if (!itemType) {
      return;
    }

    let itemValue = '';
    
    if (itemType.value === 'object') {
      itemValue = '{}';
    } else if (itemType.value === 'array') {
      itemValue = '[]';
    } else if (itemType.value === 'null') {
      itemValue = 'null';
    } else if (itemType.value === 'boolean') {
      const boolValue = await vscode.window.showQuickPick(['true', 'false'], {
        placeHolder: 'Select boolean value'
      });
      if (!boolValue) return;
      itemValue = boolValue;
    } else {
      const inputValue = await vscode.window.showInputBox({
        prompt: `Enter the value for the ${itemType.value} array item`,
        placeHolder: itemType.value === 'number' ? '123' : 'value'
      });
      if (inputValue === undefined) return;
      itemValue = inputValue;
    }

    // Create the field update for array addition
    const update: FieldUpdate = {
      path: context.path, // This already contains the array append syntax
      value: itemValue,
      type: itemType.value as any,
      operation: 'add'
    };

    await this.handleFieldUpdate(update);
    
    // Show success message
    vscode.window.showInformationMessage(`✅ Added new item to array "${context.key}"`);
  }

  // FIX 4: Add contextual field addition method
  private async addNewField() {
    if (!this.currentDocument) {
      vscode.window.showWarningMessage('Please open a YAML file first.');
      return;
    }

    const context = this.getAdditionContext();
    
    const fieldName = await vscode.window.showInputBox({
      prompt: `Enter the name for the new field (${context.description})`,
      placeHolder: 'field-name',
      validateInput: (value) => {
        if (!value || value.trim() === '') {
          return 'Field name cannot be empty';
        }
        if (value.includes('.') || value.includes('[') || value.includes(']')) {
          return 'Field name cannot contain dots, brackets, or special characters';
        }
        
        // Check if field already exists in the target container
        if (context.path && this.currentDocument?.root) {
          const parentNode = this.pathResolver.findNodeByPath(this.currentDocument.root, context.path);
          if (parentNode?.children?.some(child => child.key === value)) {
            return `Field "${value}" already exists in this location`;
          }
        }
        
        return null;
      }
    });

    if (!fieldName) {
      return;
    }

    const fieldType = await vscode.window.showQuickPick([
      { label: 'String', value: 'string' },
      { label: 'Number', value: 'number' },
      { label: 'Boolean', value: 'boolean' },
      { label: 'Object', value: 'object' },
      { label: 'Array', value: 'array' },
      { label: 'Null', value: 'null' }
    ], {
      placeHolder: 'Select the type for the new field'
    });

    if (!fieldType) {
      return;
    }

    let fieldValue = '';
    
    if (fieldType.value === 'object') {
      fieldValue = '{}';
    } else if (fieldType.value === 'array') {
      fieldValue = '[]';
    } else if (fieldType.value === 'null') {
      fieldValue = 'null';
    } else if (fieldType.value === 'boolean') {
      const boolValue = await vscode.window.showQuickPick(['true', 'false'], {
        placeHolder: 'Select boolean value'
      });
      if (!boolValue) return;
      fieldValue = boolValue;
    } else {
      const inputValue = await vscode.window.showInputBox({
        prompt: `Enter the value for the ${fieldType.value} field`,
        placeHolder: fieldType.value === 'number' ? '123' : 'value'
      });
      if (inputValue === undefined) return;
      fieldValue = inputValue;
    }

    // Construct the path based on context
    let targetPath: string;
    if (context.path === 'root') {
      targetPath = fieldName;
    } else {
      targetPath = `${context.path}.${fieldName}`;
    }

    // Create the field update
    const update: FieldUpdate = {
      path: targetPath,
      value: fieldValue,
      type: fieldType.value as any,
      operation: 'add'
    };

    await this.handleFieldUpdate(update);
    
    // Show success message with context
    vscode.window.showInformationMessage(`✅ Added "${fieldName}" ${context.description.toLowerCase()}`);
  }

  private async loadDocument(document: vscode.TextDocument) {
    try {
      const content = document.getText();
      this.currentDocument = this.yamlParser.parse(content, document.fileName);
      
      // Update tree view
      this.treeProvider.setRootNode(this.currentDocument.root);
      
      // Update webview only if panel is open and not disposed
      if (this.currentWebviewPanel && !this.webviewDisposed) {
        try {
          this.currentWebviewPanel.webview.postMessage({
            type: 'documentUpdated',
            document: this.serializeDocumentForWebview(this.currentDocument)
          });
        } catch (error) {
          console.log('Failed to update webview during load - likely disposed:', error);
        }
      }
      
    } catch (error) {
      console.error('Parse error:', error);
      vscode.window.showErrorMessage(`Failed to parse YAML: ${error}`);
    }
  }

  private isYamlFile(document: vscode.TextDocument): boolean {
    return document.languageId === 'yaml' || document.languageId === 'yml' || 
           document.fileName.endsWith('.yaml') || document.fileName.endsWith('.yml');
  }

  private isYamlFileUri(uri: vscode.Uri): boolean {
    const fileName = uri.fsPath.toLowerCase();
    return fileName.endsWith('.yaml') || fileName.endsWith('.yml');
  }

  private async openWebviewEditor() {
    if (!this.currentDocument) {
      vscode.window.showWarningMessage('Please open a YAML file first.');
      return;
    }

    // Create or show webview panel
    if (this.currentWebviewPanel) {
      this.currentWebviewPanel.reveal(vscode.ViewColumn.Beside);
    } else {
      this.currentWebviewPanel = vscode.window.createWebviewPanel(
        'yamlEditor',
        'YAML Editor',
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      this.webviewDisposed = false;

      // Create webview provider and set content
      const webviewProvider = new YAMLEditorWebviewProvider(
        this.context.extensionUri,
        (update: FieldUpdate) => this.handleFieldUpdate(update)
      );

      this.currentWebviewPanel.webview.html = webviewProvider._getHtmlForWebview(this.currentWebviewPanel.webview);

      // Handle webview disposal
      this.currentWebviewPanel.onDidDispose(() => {
        this.currentWebviewPanel = null;
        this.webviewDisposed = true;
      }, null, this.context.subscriptions);

      // Handle messages from webview
      this.currentWebviewPanel.webview.onDidReceiveMessage(
        (message) => {
          switch (message.type) {
            case 'updateField':
              this.handleFieldUpdate(message.update);
              break;
            case 'addRootField':
              this.addNewField();
              break;
            case 'openExtensionFolder':
              this.handleOpenExtensionFolder();
              break;
            case 'clearTemplateCache':
              this.handleClearTemplateCache();
              break;
          }
        },
        undefined,
        this.context.subscriptions
      );

      // Send initial document data
      this.currentWebviewPanel.webview.postMessage({
        type: 'documentUpdated',
        document: this.serializeDocumentForWebview(this.currentDocument)
      });

      // Send initial context
      setTimeout(() => {
        if (this.currentWebviewPanel && !this.webviewDisposed) {
          this.currentWebviewPanel.webview.postMessage({
            type: 'contextUpdated',
            contextNode: this.getAdditionContext()
          });
        }
      }, 100);
    }
  }

  private selectNode(path: YAMLPath | undefined, value: any, type: string) {
    // Update selected node for context
    if (path && this.currentDocument?.root) {
      this.selectedNode = this.pathResolver.findNodeByPath(this.currentDocument.root, path);
    } else {
      this.selectedNode = null;
    }

    if (this.currentWebviewPanel && !this.webviewDisposed) {
      this.currentWebviewPanel.webview.postMessage({
        type: 'nodeSelected',
        path: path,
        value: value,
        nodeType: type,
        contextNode: this.getAdditionContext()
      });
    } else {
      // If webview is not open, open it first
      this.openWebviewEditor().then(() => {
        setTimeout(() => {
          if (this.currentWebviewPanel && !this.webviewDisposed) {
            this.currentWebviewPanel.webview.postMessage({
              type: 'nodeSelected',
              path: path,
              value: value,
              nodeType: type,
              contextNode: this.getAdditionContext()
            });
          }
        }, 200);
      });
    }
  }

  private async handleFieldUpdate(update: FieldUpdate) {
    if (!this.currentDocument) {
      vscode.window.showErrorMessage('No document loaded');
      return;
    }

    // Try to get the active editor, with better detection
    let activeEditor = vscode.window.activeTextEditor;
    
    // If no active editor, try to find a YAML editor
    if (!activeEditor || !this.isYamlFile(activeEditor.document)) {
      console.log('No active YAML editor, searching for YAML tabs...');
      
      // Look through all open editors for a YAML file
      const yamlEditors = vscode.window.tabGroups.all
        .flatMap(group => group.tabs)
        .filter(tab => tab.input instanceof vscode.TabInputText)
        .map(tab => tab.input as vscode.TabInputText)
        .filter(input => this.isYamlFileUri(input.uri));
      
      if (yamlEditors.length > 0) {
        // Try to open the first YAML file found
        const document = await vscode.workspace.openTextDocument(yamlEditors[0].uri);
        activeEditor = await vscode.window.showTextDocument(document);
        console.log('Found and opened YAML editor:', document.fileName);
      } else {
        vscode.window.showErrorMessage('No YAML file is currently open. Please open a YAML file first.');
        return;
      }
    }

    try {
      console.log('Processing field update:', update);
      console.log('Active editor file:', activeEditor.document.fileName);

      // Apply the update to the document
      const updatedDocument = this.documentManipulator.applyUpdate(this.currentDocument, update);
      
      // Replace the content in the active editor
      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        activeEditor.document.positionAt(0),
        activeEditor.document.positionAt(activeEditor.document.getText().length)
      );
      edit.replace(activeEditor.document.uri, fullRange, updatedDocument.content);
      
      await vscode.workspace.applyEdit(edit);
      
      // Show success message
      vscode.window.setStatusBarMessage(`✅ YAML field ${update.operation}d successfully`, 2000);
      
      console.log('Document updated successfully');
      
    } catch (error) {
      console.error('Error updating field:', error);
      vscode.window.showErrorMessage(`Failed to update field: ${error}`);
    }
  }

  private async handleOpenExtensionFolder() {
    try {
      const extensionPath = this.context.extensionUri;
      await vscode.commands.executeCommand('revealFileInOS', extensionPath);
      vscode.window.showInformationMessage('Opened extension folder in file explorer');
    } catch (error) {
      console.error('Failed to open extension folder:', error);
      vscode.window.showErrorMessage('Failed to open extension folder');
    }
  }

  private async handleClearTemplateCache() {
    try {
      // Import the webview provider to access its static method
      const { YAMLEditorWebviewProvider } = await import('./infrastructure/webviewProvider');
      YAMLEditorWebviewProvider.clearTemplateCache();
      
      // Notify the webview that cache was cleared
      if (this.currentWebviewPanel && !this.webviewDisposed) {
        this.currentWebviewPanel.webview.postMessage({
          type: 'cacheCleared',
          timestamp: new Date().toISOString()
        });
      }
      
      vscode.window.showInformationMessage('Template cache cleared. Refresh the webview to reload templates.');
      console.log('Template cache cleared successfully');
    } catch (error) {
      console.error('Failed to clear template cache:', error);
      vscode.window.showErrorMessage('Failed to clear template cache');
    }
  }

  private refreshView() {
    if (vscode.window.activeTextEditor && this.isYamlFile(vscode.window.activeTextEditor.document)) {
      this.loadDocument(vscode.window.activeTextEditor.document);
    }
    this.treeProvider.refresh();
  }

  private serializeDocumentForWebview(document: YAMLDocument): any {
    return {
      content: document.content,
      filePath: document.filePath,
      rootKeys: document.root?.children?.map(child => child.key) || []
    };
  }
}