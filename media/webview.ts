// VS Code Webview API types
interface VSCodeApi {
    postMessage(message: any): void;
    setState(state: any): void;
    getState(): any;
}

// Message types for communication with extension
interface UpdateFieldMessage {
    type: 'updateField';
    update: FieldUpdate;
}

interface AddRootFieldMessage {
    type: 'addRootField';
}

interface OpenExtensionFolderMessage {
    type: 'openExtensionFolder';
    timestamp: string;
}

interface ClearTemplateCacheMessage {
    type: 'clearTemplateCache';
    timestamp: string;
}

type WebviewMessage = UpdateFieldMessage | AddRootFieldMessage | OpenExtensionFolderMessage | ClearTemplateCacheMessage;

// Incoming message types from extension
interface DocumentUpdatedMessage {
    type: 'documentUpdated';
    document: SerializedYAMLDocument;
}

interface ContextUpdatedMessage {
    type: 'contextUpdated';
    contextNode: AdditionContext | null;
}

interface NodeSelectedMessage {
    type: 'nodeSelected';
    path: string;
    value: any;
    nodeType: string;
    contextNode?: AdditionContext;
}

interface CacheClearedMessage {
    type: 'cacheCleared';
    timestamp: string;
}

interface TemplateReloadedMessage {
    type: 'templateReloaded';
    timestamp: string;
}

type ExtensionMessage = DocumentUpdatedMessage | ContextUpdatedMessage | NodeSelectedMessage | CacheClearedMessage | TemplateReloadedMessage;

// Data types
interface FieldUpdate {
    path: string;
    value: string;
    type: YAMLNodeType;
    operation: 'add' | 'update' | 'delete';
}

interface SerializedYAMLDocument {
    content: string;
    filePath: string;
    rootKeys: string[];
}

interface AdditionContext {
    path: string;
    key: string;
    type: string;
    isContainer: boolean;
    isArray: boolean;
    description: string;
}

type YAMLNodeType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';

// Form elements interface
interface FormElements {
    form: HTMLFormElement;
    pathDisplay: HTMLElement;
    valueInput: HTMLTextAreaElement;
    typeSelect: HTMLSelectElement;
    statusMessage: HTMLElement;
    
    // Mode toggle elements
    editModeBtn: HTMLButtonElement;
    addModeBtn: HTMLButtonElement;
    editModeFields: HTMLElement;
    addModeFields: HTMLElement;
    editModeButtons: HTMLElement;
    addModeButtons: HTMLElement;
    
    // Button elements
    updateBtn: HTMLButtonElement;
    addBtn: HTMLButtonElement;
    deleteBtn: HTMLButtonElement;
    cancelAddBtn: HTMLButtonElement;
    
    // Add mode specific elements
    newFieldNameInput: HTMLInputElement;
    contextDisplay: HTMLElement;
    fieldNameContainer: HTMLElement;
    arrayItemContainer: HTMLElement;
}

interface TooltipPair {
    element: HTMLElement;
    tooltip: HTMLElement;
}

class YAMLEditor {
    private vscode: VSCodeApi;
    private elements!: FormElements;
    
    // State
    private currentDocument: SerializedYAMLDocument | null = null;
    private selectedPath: string | null = null;
    private autoSaveTimeout: number | null = null;
    private isAddMode: boolean = false;
    private additionContext: AdditionContext | null = null;

    constructor() {
        this.vscode = this.acquireVsCodeApi();
        this.initializeElements();
        this.bindEvents();
        this.setupTooltips();
        this.clearForm();
        
        console.log('YAML Editor initialized with TypeScript');
    }

    private acquireVsCodeApi(): VSCodeApi {
        // @ts-ignore - acquireVsCodeApi is provided by VS Code webview context
        return acquireVsCodeApi();
    }

    private initializeElements(): void {
        this.elements = {
            // Form elements
            form: this.getElement<HTMLFormElement>('fieldForm'),
            pathDisplay: this.getElement('pathDisplay'),
            valueInput: this.getElement<HTMLTextAreaElement>('value'),
            typeSelect: this.getElement<HTMLSelectElement>('type'),
            statusMessage: this.getElement('statusMessage'),
            
            // Mode toggle elements
            editModeBtn: this.getElement<HTMLButtonElement>('editModeBtn'),
            addModeBtn: this.getElement<HTMLButtonElement>('addModeBtn'),
            editModeFields: this.getElement('editModeFields'),
            addModeFields: this.getElement('addModeFields'),
            editModeButtons: this.getElement('editModeButtons'),
            addModeButtons: this.getElement('addModeButtons'),
            
            // Button elements
            updateBtn: this.getElement<HTMLButtonElement>('updateBtn'),
            addBtn: this.getElement<HTMLButtonElement>('addBtn'),
            deleteBtn: this.getElement<HTMLButtonElement>('deleteBtn'),
            cancelAddBtn: this.getElement<HTMLButtonElement>('cancelAddBtn'),
            
            // Add mode specific elements
            newFieldNameInput: this.getElement<HTMLInputElement>('newFieldName'),
            contextDisplay: this.getElement('contextDisplay'),
            fieldNameContainer: this.getElement('fieldNameContainer'),
            arrayItemContainer: this.getElement('arrayItemContainer')
        };
    }

    private getElement<T extends HTMLElement = HTMLElement>(id: string): T {
        const element = document.getElementById(id);
        if (!element) {
            throw new Error(`Element with id '${id}' not found`);
        }
        return element as T;
    }

    private bindEvents(): void {
        // Mode switching
        this.elements.editModeBtn.addEventListener('click', () => this.switchToEditMode());
        this.elements.addModeBtn.addEventListener('click', () => this.switchToAddMode());
        this.elements.cancelAddBtn.addEventListener('click', () => this.switchToEditMode());

        // Auto-save functionality (only in edit mode)
        this.elements.valueInput.addEventListener('input', () => {
            if (!this.isAddMode) this.scheduleAutoSave();
        });
        
        this.elements.typeSelect.addEventListener('change', () => {
            if (!this.isAddMode && this.selectedPath) {
                this.handleUpdate();
            }
        });

        // Enter key handling
        this.elements.valueInput.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (this.isAddMode) {
                    this.handleAdd();
                } else if (this.selectedPath) {
                    this.handleUpdate();
                }
            }
        });

        // Field name validation for add mode
        this.elements.newFieldNameInput.addEventListener('input', (e: Event) => {
            const target = e.target as HTMLInputElement;
            const value = target.value;
            // Remove invalid characters
            const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, '');
            if (cleaned !== value) {
                target.value = cleaned;
            }
        });

        // Action buttons
        this.elements.updateBtn.addEventListener('click', () => this.handleUpdate());
        this.elements.addBtn.addEventListener('click', () => this.handleAdd());
        this.elements.deleteBtn.addEventListener('click', () => this.handleDelete());

        // Message handling from extension
        window.addEventListener('message', (event: MessageEvent<ExtensionMessage>) => {
            this.handleMessage(event.data);
        });
    }

    private setupTooltips(): void {
        const tooltipPairs: TooltipPair[] = [
            { 
                element: this.elements.pathDisplay, 
                tooltip: this.getElement('pathTooltip') 
            },
            { 
                element: this.elements.valueInput, 
                tooltip: this.getElement('valueTooltip') 
            },
            { 
                element: this.elements.typeSelect, 
                tooltip: this.getElement('typeTooltip') 
            }
        ];

        tooltipPairs.forEach(({ element, tooltip }) => {
            if (element && tooltip) {
                element.addEventListener('mouseenter', () => {
                    this.updateTooltipContent(tooltip, element);
                    tooltip.classList.add('show');
                });
                
                element.addEventListener('mouseleave', () => {
                    tooltip.classList.remove('show');
                });
            }
        });
    }

    private updateTooltipContent(tooltip: HTMLElement, element: HTMLElement): void {
        if (element === this.elements.pathDisplay) {
            tooltip.textContent = this.selectedPath 
                ? `Full YAML path: ${this.selectedPath}`
                : 'Select a field from the tree view to see its path';
        }
    }

    // Mode switching methods
    private switchToEditMode(): void {
        this.isAddMode = false;
        this.elements.editModeBtn.classList.add('active');
        this.elements.addModeBtn.classList.remove('active');
        this.elements.editModeFields.classList.remove('hidden');
        this.elements.addModeFields.classList.add('hidden');
        this.elements.editModeButtons.classList.remove('hidden');
        this.elements.addModeButtons.classList.add('hidden');
    }

    private switchToAddMode(): void {
        this.isAddMode = true;
        this.elements.addModeBtn.classList.add('active');
        this.elements.editModeBtn.classList.remove('active');
        this.elements.editModeFields.classList.add('hidden');
        this.elements.addModeFields.classList.remove('hidden');
        this.elements.editModeButtons.classList.add('hidden');
        this.elements.addModeButtons.classList.remove('hidden');
        
        // Clear add mode fields
        this.elements.newFieldNameInput.value = '';
        this.elements.valueInput.value = '';
        this.elements.typeSelect.value = 'string';
        
        // Update context display
        this.updateContextDisplay();
    }

    private updateContextDisplay(): void {
        if (this.additionContext) {
            this.elements.contextDisplay.textContent = this.additionContext.description || 'Add to selected location';
            this.elements.contextDisplay.style.backgroundColor = 'var(--vscode-merge-incomingHeaderBackground)';
            
            // Show/hide field name input based on whether we're adding to an array
            if (this.additionContext.isArray) {
                this.elements.fieldNameContainer.classList.add('hidden');
                this.elements.arrayItemContainer.classList.remove('hidden');
            } else {
                this.elements.fieldNameContainer.classList.remove('hidden');
                this.elements.arrayItemContainer.classList.add('hidden');
            }
        } else {
            this.elements.contextDisplay.textContent = 'Add to root level (select a node in tree for different location)';
            this.elements.contextDisplay.style.backgroundColor = 'var(--vscode-textCodeBlock-background)';
            this.elements.fieldNameContainer.classList.remove('hidden');
            this.elements.arrayItemContainer.classList.add('hidden');
        }
    }

    // Auto-save functionality
    private scheduleAutoSave(): void {
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }
        
        this.autoSaveTimeout = window.setTimeout(() => {
            if (this.selectedPath && this.elements.valueInput.value !== '') {
                this.handleUpdate();
            }
        }, 1000);
    }

    // Action handlers
    private handleUpdate(): void {
        if (!this.selectedPath) {
            this.showStatus('Please select a field first', true);
            return;
        }

        const value = this.elements.valueInput.value;
        const type = this.elements.typeSelect.value as YAMLNodeType;

        console.log('Sending update:', { path: this.selectedPath, value, type });
        
        this.sendMessage({
            type: 'updateField',
            update: {
                path: this.selectedPath,
                value: value,
                type: type,
                operation: 'update'
            }
        });
        
        this.showStatus('Field updated successfully!');
    }

    private handleAdd(): void {
        const value = this.elements.valueInput.value;
        const type = this.elements.typeSelect.value as YAMLNodeType;
        
        // Validate value
        if (!value && type !== 'object' && type !== 'array' && type !== 'null') {
            this.showStatus('Please enter a value', true);
            this.elements.valueInput.focus();
            return;
        }

        let fullPath: string;
        let fieldName = '';

        // Check if we're adding to an array
        if (this.additionContext && this.additionContext.isArray) {
            // For arrays, use the path directly
            fullPath = this.additionContext.path;
            console.log('Adding to array with path:', fullPath);
        } else {
            // For objects, we need a field name
            fieldName = this.elements.newFieldNameInput.value.trim();
            if (!fieldName) {
                this.showStatus('Please enter a field name', true);
                this.elements.newFieldNameInput.focus();
                return;
            }
            
            // Construct the full path based on context
            if (this.additionContext && this.additionContext.path && this.additionContext.path !== 'root') {
                fullPath = this.additionContext.path + '.' + fieldName;
            } else {
                fullPath = fieldName; // Root level addition
            }
        }

        console.log('Sending contextual add:', { 
            path: fullPath, 
            value, 
            type, 
            context: this.additionContext,
            isArrayAddition: this.additionContext?.isArray 
        });
        
        this.sendMessage({
            type: 'updateField',
            update: {
                path: fullPath,
                value: value,
                type: type,
                operation: 'add'
            }
        });
        
        if (this.additionContext?.isArray) {
            this.showStatus('Array item added successfully!');
        } else {
            this.showStatus('Field added successfully!');
        }
        
        // Clear the form and switch back to edit mode
        setTimeout(() => {
            this.switchToEditMode();
        }, 1500);
    }

    private handleDelete(): void {
        if (!this.selectedPath) {
            this.showStatus('Please select a field first', true);
            return;
        }

        if (confirm(`Are you sure you want to delete "${this.selectedPath}"?`)) {
            this.sendMessage({
                type: 'updateField',
                update: {
                    path: this.selectedPath,
                    value: '',
                    type: 'null',
                    operation: 'delete'
                }
            });
            
            this.showStatus('Field deleted successfully!');
            this.clearForm();
        }
    }

    // Message handling
    private handleMessage(message: ExtensionMessage): void {
        console.log('Webview received message:', message);

        switch (message.type) {
            case 'documentUpdated':
                this.currentDocument = message.document;
                console.log('Document updated in webview');
                break;
                
            case 'contextUpdated':
                this.additionContext = message.contextNode;
                this.updateContextDisplay();
                console.log('Context updated:', this.additionContext);
                break;
                
            case 'nodeSelected':
                this.handleNodeSelected(message);
                break;
                
            case 'cacheCleared':
                console.log('Template cache cleared');
                this.showStatus('Template cache cleared');
                break;
                
            case 'templateReloaded':
                console.log('Templates reloaded, refreshing...');
                setTimeout(() => location.reload(), 500);
                break;
        }
    }

    private handleNodeSelected(message: NodeSelectedMessage): void {
        // Automatically switch to edit mode when a node is selected
        if (this.isAddMode) {
            this.switchToEditMode();
        }
        
        this.selectedPath = message.path;
        this.elements.pathDisplay.textContent = message.path || 'root';
        
        // Update addition context if provided
        if (message.contextNode) {
            this.additionContext = message.contextNode;
        }
        
        if (message.value !== undefined && message.value !== null) {
            this.elements.valueInput.value = typeof message.value === 'object' ? 
                JSON.stringify(message.value, null, 2) : 
                String(message.value);
        } else {
            this.elements.valueInput.value = '';
        }
        
        if (message.nodeType) {
            this.elements.typeSelect.value = message.nodeType;
        }
        
        console.log('Node selected:', message);
    }

    // Utility methods
    private showStatus(message: string, isError: boolean = false): void {
        this.elements.statusMessage.textContent = message;
        this.elements.statusMessage.className = 'status-message ' + (isError ? 'status-error' : 'status-success');
        this.elements.statusMessage.style.display = 'block';
        
        setTimeout(() => {
            this.elements.statusMessage.style.display = 'none';
        }, 3000);
    }

    private clearForm(): void {
        this.selectedPath = null;
        this.elements.pathDisplay.textContent = 'Select a field from the tree view';
        this.elements.valueInput.value = '';
        this.elements.typeSelect.value = 'string';
    }

    private sendMessage(message: WebviewMessage): void {
        this.vscode.postMessage(message);
    }

    // Public methods for external access if needed
    public getCurrentDocument(): SerializedYAMLDocument | null {
        return this.currentDocument;
    }

    public getSelectedPath(): string | null {
        return this.selectedPath;
    }

    public getAdditionContext(): AdditionContext | null {
        return this.additionContext;
    }
}

// Initialize the editor when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        new YAMLEditor();
    } catch (error) {
        console.error('Failed to initialize YAML Editor:', error);
        document.body.innerHTML = `
            <div style="padding: 20px; color: var(--vscode-errorForeground);">
                <h2>⚠️ Initialization Error</h2>
                <p>Failed to initialize the YAML Editor TypeScript module.</p>
                <p>Error: ${error}</p>
                <button onclick="location.reload()">🔄 Retry</button>
            </div>
        `;
    }
});