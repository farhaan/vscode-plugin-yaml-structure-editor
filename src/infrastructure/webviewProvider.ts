import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { FieldUpdate } from '../domain/entities';

// Optional: Install mustache for advanced templating
// npm install mustache @types/mustache
// import * as Mustache from 'mustache';

interface TemplateContext {
    // Security and URIs
    styleResetUri: string;
    styleVSCodeUri: string;
    stylesUri: string;
    scriptUri: string;
    cspSource: string;
    nonce: string;
    
    // App metadata
    appTitle: string;
    version: string;
    
    // Dynamic features
    features: string[];
    supportedTypes: Array<{
        value: string;
        label: string;
        selected?: boolean;
    }>;
    
    // Development and debug
    showDebugInfo: boolean;
    debugData?: string;
    timestamp: string;
    
    // Mustache helpers (if using Mustache)
    helpers?: {
        formatDate: () => string;
        upperCase: () => (text: string, render?: (template: string) => string) => string;
        isArray: () => (value: any) => boolean;
    };
}

export class YAMLEditorWebviewProvider {
    private static readonly TEMPLATE_CACHE = new Map<string, string>();
    private static readonly SUPPORTED_TYPES = [
        { value: 'string', label: 'String', selected: true },
        { value: 'number', label: 'Number' },
        { value: 'boolean', label: 'Boolean' },
        { value: 'object', label: 'Object' },
        { value: 'array', label: 'Array' },
        { value: 'null', label: 'Null' }
    ];

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _onFieldUpdate: (update: FieldUpdate) => void
    ) {}

    _getHtmlForWebview(webview: vscode.Webview): string {
        try {
            const context = this.buildTemplateContext(webview);
            return this.renderTemplate('webview.mustache', context);
        } catch (error) {
            console.error('Failed to render webview template:', error);
            return this.getFallbackHtml(webview);
        }
    }

    private buildTemplateContext(webview: vscode.Webview): TemplateContext {
        const nonce = this.generateNonce();
        const isDevMode = process.env.NODE_ENV === 'development';
        
        const context: TemplateContext = {
            // Security and resource URIs
            styleResetUri: webview.asWebviewUri(
                vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css')
            ).toString(),
            styleVSCodeUri: webview.asWebviewUri(
                vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css')
            ).toString(),
            stylesUri: webview.asWebviewUri(
                vscode.Uri.joinPath(this._extensionUri, 'media', 'webview.css')
            ).toString(),
            scriptUri: webview.asWebviewUri(
                vscode.Uri.joinPath(this._extensionUri, 'media', 'dist', 'webview.js')
            ).toString(),
            cspSource: webview.cspSource,
            nonce: nonce,
            
            // App information
            appTitle: 'YAML Structure Editor',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            
            // Dynamic features
            features: [
                'contextual-editing',
                'array-support', 
                'real-time-preview',
                'auto-save',
                'type-validation',
                'tree-navigation'
            ],
            
            // Form configuration
            supportedTypes: [...YAMLEditorWebviewProvider.SUPPORTED_TYPES],
            
            // Development features
            showDebugInfo: isDevMode,
            debugData: isDevMode ? JSON.stringify({
                timestamp: new Date().toISOString(),
                extensionPath: this._extensionUri.fsPath,
                webviewState: 'initialized',
                templateCache: YAMLEditorWebviewProvider.TEMPLATE_CACHE.size
            }, null, 2) : undefined
        };

        // Add Mustache helpers if using Mustache templating
        if (this.isMustacheAvailable()) {
            context.helpers = {
                formatDate: () => new Date().toLocaleDateString(),
                upperCase: () => (text: string, render?: (template: string) => string) => {
                    const rendered = render ? render(text) : text;
                    return rendered.toUpperCase();
                },
                isArray: () => (value: any) => Array.isArray(value)
            };
        }
        
        return context;
    }

    private renderTemplate(templateName: string, context: TemplateContext): string {
        const template = this.loadTemplate(templateName);
        
        // Check if Mustache is available and template is .mustache
        if (this.isMustacheAvailable() && templateName.endsWith('.mustache')) {
            // const Mustache = require('mustache');
            // return Mustache.render(template, context);
            console.log('Mustache templating requested but not implemented in this example');
        }
        
        // Use simple template replacement
        return this.simpleTemplateReplace(template, context);
    }

    private loadTemplate(templateName: string): string {
        // Check cache first for performance
        const cacheKey = templateName;
        if (YAMLEditorWebviewProvider.TEMPLATE_CACHE.has(cacheKey)) {
            return YAMLEditorWebviewProvider.TEMPLATE_CACHE.get(cacheKey)!;
        }

        const templatePath = path.join(this._extensionUri.fsPath, 'media', templateName);
        
        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template file not found: ${templatePath}`);
        }

        try {
            const template = fs.readFileSync(templatePath, 'utf8');
            
            // Cache the template for future use
            YAMLEditorWebviewProvider.TEMPLATE_CACHE.set(cacheKey, template);
            
            return template;
        } catch (error) {
            throw new Error(`Failed to read template file: ${templatePath} - ${error}`);
        }
    }

    private simpleTemplateReplace(template: string, context: TemplateContext): string {
        let result = template;
        
        // Replace all simple placeholders {{key}}
        for (const [key, value] of Object.entries(context)) {
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                const placeholder = new RegExp(`{{${key}}}`, 'g');
                result = result.replace(placeholder, String(value));
            }
        }
        
        // Handle arrays (simple implementation)
        if (context.features && Array.isArray(context.features)) {
            const featuresHtml = context.features
                .map(feature => `<span class="feature-tag">${feature}</span>`)
                .join(' ');
            result = result.replace(/{{#features}}.*?{{\/features}}/gs, featuresHtml);
        }
        
        // Handle supportedTypes for select options
        if (context.supportedTypes && Array.isArray(context.supportedTypes)) {
            const optionsHtml = context.supportedTypes
                .map(type => `<option value="${type.value}"${type.selected ? ' selected' : ''}>${type.label}</option>`)
                .join('\n                    ');
            result = result.replace(/{{#supportedTypes}}.*?{{\/supportedTypes}}/gs, optionsHtml);
        }
        
        // Handle conditional sections
        if (context.showDebugInfo) {
            result = result.replace(/{{#showDebugInfo}}(.*?){{\/showDebugInfo}}/gs, '$1');
            if (context.debugData) {
                result = result.replace(/{{debugData}}/g, context.debugData);
            }
        } else {
            result = result.replace(/{{#showDebugInfo}}.*?{{\/showDebugInfo}}/gs, '');
        }
        
        // Clean up any remaining placeholders
        result = result.replace(/{{[^}]+}}/g, '');
        
        return result;
    }

    private isMustacheAvailable(): boolean {
        try {
            require.resolve('mustache');
            return true;
        } catch {
            return false;
        }
    }

    private generateNonce(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 32; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    private getFallbackHtml(webview: vscode.Webview): string {
        try {
            // Try to use fallback template first
            const fallbackContext = this.buildFallbackContext(webview);
            return this.renderTemplate('fallback.mustache', fallbackContext);
        } catch (templateError) {
            console.error('Fallback template also failed, using ultimate fallback:', templateError);
            return this.getUltimateFallbackHtml(webview);
        }
    }

    private buildFallbackContext(webview: vscode.Webview): TemplateContext {
        const nonce = this.generateNonce();
        
        return {
            // Basic security
            cspSource: webview.cspSource,
            nonce: nonce,
            
            // Minimal styling (inline for ultimate reliability)
            styleResetUri: '',
            styleVSCodeUri: '',
            stylesUri: '',
            scriptUri: '',
            
            // App info
            appTitle: 'YAML Structure Editor - Fallback Mode',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            
            // Empty arrays to prevent template errors
            features: [],
            supportedTypes: [],
            
            // Debug info for troubleshooting
            showDebugInfo: true,
            debugData: JSON.stringify({
                error: 'Template loading failed',
                timestamp: new Date().toISOString(),
                extensionPath: this._extensionUri.fsPath,
                cacheSize: YAMLEditorWebviewProvider.TEMPLATE_CACHE.size
            }, null, 2)
        };
    }

    private getUltimateFallbackHtml(webview: vscode.Webview): string {
        const nonce = this.generateNonce();
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>YAML Editor - Critical Error</title>
    <style>
        body { 
            font-family: var(--vscode-font-family); 
            padding: 20px; 
            color: var(--vscode-errorForeground);
            background-color: var(--vscode-editor-background);
        }
        .critical-error {
            border: 2px solid var(--vscode-errorBorder);
            padding: 20px;
            border-radius: 8px;
            background-color: var(--vscode-inputValidation-errorBackground);
        }
    </style>
</head>
<body>
    <div class="critical-error">
        <h2>💥 Critical Template Error</h2>
        <p>Both main and fallback templates failed to load. Please check your extension installation.</p>
        <button onclick="location.reload()">Retry</button>
    </div>
    <script nonce="${nonce}">console.log('Ultimate fallback active');</script>
</body>
</html>`;
    }

    // Static methods for cache management
    public static clearTemplateCache(): void {
        YAMLEditorWebviewProvider.TEMPLATE_CACHE.clear();
        console.log('Template cache cleared');
    }

    public static getTemplateCacheStats(): { size: number; keys: string[] } {
        return {
            size: YAMLEditorWebviewProvider.TEMPLATE_CACHE.size,
            keys: Array.from(YAMLEditorWebviewProvider.TEMPLATE_CACHE.keys())
        };
    }

    // Method to reload templates in development mode
    public reloadTemplates(): void {
        if (process.env.NODE_ENV === 'development') {
            YAMLEditorWebviewProvider.clearTemplateCache();
            console.log('Templates reloaded in development mode');
        }
    }
}