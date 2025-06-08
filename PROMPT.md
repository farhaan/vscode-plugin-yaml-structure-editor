# AI Prompt: Create a YAML Structure Editor VS Code Extension

Use this comprehensive prompt with any AI assistant (Claude, ChatGPT, etc.) to recreate similar functionality:

---

## **Master Prompt**

`--PROMPT START--`
I want you to help me create a professional VS Code extension for editing YAML files with a visual interface. Here are the detailed requirements:

### CORE FUNCTIONALITY
Create a VS Code extension called "YAML Structure Editor" that provides:

1. **Interactive Tree View**: Display YAML file structure in VS Code's Explorer sidebar
2. **Visual Editor**: A webview-based form editor for modifying YAML values
3. **Real-time Sync**: Changes in either interface update the YAML file immediately
4. **Type Safety**: Full TypeScript implementation with strict type checking

### SPECIFIC FEATURES REQUIRED

#### Tree View Requirements:
- Show hierarchical YAML structure with expandable/collapsible nodes
- Display different icons for arrays, objects, strings, numbers, booleans
- Context menus with "Add Array Item", "Add New Field", "Edit Field" options
- Handle empty arrays and objects properly (they should still show context menus)
- Show value previews like "[3 items]" for arrays, "{5 keys}" for objects
- Support right-click context menus that are context-aware based on node type

#### Webview Editor Requirements:
- Two-mode interface: "Edit Existing" and "Add New Field" modes
- Form with fields for: YAML path, value (textarea), type dropdown (string/number/boolean/object/array/null)
- Auto-save functionality with 1-second delay after typing stops
- Support for adding items to arrays (including empty arrays)
- Support for adding properties to objects
- Context-aware field addition based on selected tree node
- Professional UI with VS Code theme integration

#### Technical Architecture:
- Use Domain-Driven Design with clean separation of concerns
- Implement these core services:
  * YAML Parser (using 'yaml' npm package)
  * Document Manipulator (for AST-based editing)
  * Path Resolver (for YAML path navigation)
- Separate Tree Provider and Webview Provider classes
- Use TypeScript with strict settings including exactOptionalPropertyTypes
- Implement comprehensive error handling with graceful fallbacks

### FILE STRUCTURE REQUIRED
```
src/
├── domain/
│   ├── entities.ts (interfaces and types)
│   └── services/
│       ├── yamlParser.ts
│       ├── documentManipulator.ts
│       └── pathResolver.ts
├── infrastructure/
│   ├── treeProvider.ts
│   └── webviewProvider.ts
└── extension.ts (main entry point)

media/
├── webview.ts (TypeScript source)
├── webview.html (template)
├── webview.css (styles)
├── fallback.html (error template)
├── tsconfig.json
└── dist/ (compiled output)
```

### WEBVIEW IMPLEMENTATION REQUIREMENTS
- Write webview logic in TypeScript, not JavaScript
- Use template-based HTML with placeholder replacement ({{variable}} syntax)
- Implement 3-tier fallback system: main template → fallback template → hardcoded minimal HTML
- Support message passing between extension and webview with typed interfaces
- Include proper Content Security Policy with nonces
- Make the webview responsive and accessible

### CRITICAL FEATURES TO IMPLEMENT

1. **Array Handling**: 
   - Empty arrays must show "Add Array Item" context menu
   - Context detection should work for both empty and populated arrays
   - Array addition should use special "__append__" path syntax

2. **Type-Based Context Menus**:
   - Arrays (even empty) get "yamlArray" context value
   - Objects get "yamlContainer" context value  
   - Primitives get "yamlValue" context value
   - Context menus are based on type, not content

3. **Path-Based Operations**:
   - Use dot notation for nested paths (e.g., "root.config.items")
   - Support array append operations with special syntax
   - Validate paths before applying operations

4. **Professional Error Handling**:
   - Template loading failures should show user-friendly fallback
   - YAML parsing errors should be caught and displayed clearly
   - File operation failures should not crash the extension

### PACKAGE.JSON REQUIREMENTS
Include proper VS Code extension manifest with:
- Activation events for .yaml and .yml files
- Tree view contribution to Explorer
- Context menu contributions for tree items
- Command definitions for all operations
- TypeScript and Node.js as devDependencies

### BUILD SYSTEM REQUIREMENTS
- TypeScript compilation for both extension and webview
- Watch mode for development
- Source maps for debugging
- Build scripts for production compilation
- Clean command for build artifacts

### UI/UX REQUIREMENTS
- Use VS Code theme variables for consistent styling
- Professional icons from VS Code's built-in icon set
- Tooltips explaining available actions
- Status messages for user feedback
- Responsive design that works in narrow sidebars

### ADVANCED FEATURES
- Template caching for webview performance
- Development mode with additional debugging
- Graceful handling of malformed YAML
- Support for YAML comments preservation
- Auto-formatting of YAML output

Please implement this step by step, starting with the basic project structure, then the domain layer, then the infrastructure layer, and finally the webview implementation. Use modern TypeScript best practices and ensure everything is type-safe.

Make sure to handle edge cases like:
- Empty arrays and objects
- Deeply nested structures  
- Invalid YAML syntax
- Missing files
- Webview template loading failures

I want the code to be production-ready with proper error handling, type safety, and professional user experience.

`--PROMPT END--`



## **How to Use This Prompt**

### **Step 1: Copy the Prompt**
Copy the entire prompt above (everything between the `--PROMPT START--` and `--PROMPT END--`).

### **Step 2: Choose Your AI Assistant**
This prompt works with:
- **Claude 4 Sonnet** (recommended - excellent at complex coding tasks)
- **ChatGPT-4** (good alternative)
- **GitHub Copilot Chat** (for iterative development)
- **Any coding-focused AI assistant**

### **Step 3: Initial Request**
Paste the prompt and add:
```
"Please start by creating the basic project structure and package.json configuration."
```

### **Step 4: Iterative Development**
Follow up with specific requests like:
- "Now implement the domain layer with the YAML parser and document manipulator"
- "Create the tree provider with proper context menu handling"
- "Implement the webview provider with TypeScript templating"
- "Add the TypeScript webview implementation with type safety"

### **Step 5: Refinements**
Ask for specific improvements:
- "Fix the empty array handling in the tree view"
- "Add better error handling for template loading failures"
- "Improve the UI with better tooltips and status messages"

## 🔧 **Customization Options**

### **Modify for Different File Types**
Change this part of the prompt:
```
"Create a [FILE_TYPE] Structure Editor VS Code extension"
"Activation events for .[EXTENSION] files"
```

### **Add Different Features**
Extend the prompt with:
```
"Additionally, I want these features:
- Syntax highlighting
- Schema validation  
- Import/export functionality
- Multi-file support"
```

### **Different Architecture**
Modify the technical requirements:
```
"Use [ARCHITECTURE_PATTERN] instead of Domain-Driven Design"
"Implement with [FRAMEWORK] for the webview"
"Use [BUILD_TOOL] instead of TypeScript compiler"
```

## **Expected Results**

Using this prompt, you should get:
- **Complete VS Code extension** with all requested features
- **TypeScript implementation** with full type safety
- **Professional UI/UX** with VS Code theme integration
- **Robust error handling** with graceful fallbacks
- **Modular architecture** that's easy to extend
- **Build system** with development and production modes

## **Success Tips**

1. **Be Specific**: The more detailed your requirements, the better the output
2. **Iterate**: Ask for improvements and refinements as needed
3. **Test Thoroughly**: Always test the generated code in VS Code
4. **Customize**: Adapt the prompt for your specific needs
5. **Follow Up**: Ask clarifying questions if anything is unclear

This prompt has been tested and refined to produce high-quality, production-ready VS Code extensions! 🚀