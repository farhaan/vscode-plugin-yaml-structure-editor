# YAML Structure Editor - VS Code Extension

A comprehensive VS Code extension for visual YAML editing with an interactive tree view and webview editor. This extension provides a user-friendly interface for editing YAML files with real-time updates, type safety, and contextual editing capabilities.

**Note**: This project was developed using Large Language Model (LLM) assistance, specifically Claude 3.5 Sonnet, demonstrating the capabilities of AI-assisted software development for creating production-ready VS Code extensions.

## Features

### Interactive Tree View
- Visual YAML structure displayed in VS Code's explorer panel
- Expandable and collapsible nodes for easy navigation
- Type-specific icons for arrays, objects, strings, numbers, and booleans
- Contextual right-click menus for adding and editing fields
- Real-time updates when YAML file changes
- Proper handling of empty arrays and objects

### Professional Webview Editor
- Dual-mode interface: Edit existing fields or add new ones
- Type-safe form controls with validation
- Auto-save functionality with configurable delay
- Comprehensive array support including empty arrays
- Contextual field addition based on selected tree node
- Professional UI matching VS Code themes

### Advanced Technical Capabilities
- TypeScript-powered webview with full type safety
- Template-based UI rendering with fallback error handling
- AST-based YAML manipulation preserving formatting and comments
- Real-time synchronization between tree view and text editor
- Robust error handling with graceful degradation
- Modular architecture following domain-driven design principles

## Installation

### Prerequisites
- VS Code 1.60.0 or higher
- Node.js 16.x or higher
- TypeScript 5.0.0 or higher

### Setup
1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd yaml-structure-editor
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Open in VS Code:
   ```bash
   code .
   ```

5. Run the extension:
   - Press F5 to open Extension Development Host
   - Open any .yaml or .yml file
   - The YAML Structure panel will appear in the Explorer sidebar

## Usage

### Basic Editing
1. Open a YAML file in VS Code
2. View the structure in the "YAML Structure" panel in Explorer
3. Click on any field to edit its value in the webview
4. Right-click nodes to add new fields or array items
5. Changes save automatically to your YAML file

### Adding New Fields
- Right-click objects: Select "Add New Field" to add properties
- Right-click arrays: Select "Add Array Item" to add items (works with empty arrays)
- Use webview: Switch to "Add New Field" mode for guided addition

### Array Management
- Empty arrays display "[empty]" and offer "Add Array Item" option
- Populated arrays show "[n items]" with same functionality
- Context-aware descriptions guide users through the process

## Project Structure

```
yaml-structure-editor/
├── src/                              # Main extension source code
│   ├── domain/                       # Core business logic
│   │   ├── entities.ts               # Type definitions and interfaces
│   │   └── services/                 # Business logic services
│   │       ├── documentManipulator.ts # YAML document manipulation
│   │       ├── pathResolver.ts       # YAML path resolution
│   │       └── yamlParser.ts         # YAML parsing utilities
│   ├── infrastructure/               # VS Code integration layer
│   │   ├── treeProvider.ts           # Tree view implementation
│   │   └── webviewProvider.ts        # Webview management
│   └── extension.ts                  # Main extension entry point
├── media/                            # Webview assets
│   ├── webview.ts                    # TypeScript webview source
│   ├── webview.html                  # HTML template
│   ├── webview.css                   # Webview styles
│   ├── fallback.html                 # Error fallback template
│   ├── tsconfig.json                 # Webview TypeScript config
│   └── dist/                         # Compiled webview assets
│       ├── webview.js                # Compiled JavaScript
│       └── webview.js.map            # Source maps for debugging
├── scripts/                          # Build utilities
│   ├── build-webview.js              # Webview build script
│   └── watch-webview.js              # Development watch script
├── package.json                      # Extension manifest
├── tsconfig.json                     # Main TypeScript config
└── README.md                         # Documentation
```

## Development

### Building
```bash
# Build everything (extension + webview)
npm run build

# Build only the main extension
npm run compile

# Build only the webview
npm run compile:webview

# Clean build artifacts
npm run clean
```

### Development Workflow
```bash
# Start watch mode (both extension and webview)
npm run dev

# Watch only extension
npm run watch

# Watch only webview
npm run watch:webview

# Use build scripts directly
node scripts/build-webview.js
node scripts/watch-webview.js
```

### Testing
1. Press F5 in VS Code to start Extension Development Host
2. Open a YAML file in the new window
3. Test tree view interactions and webview functionality
4. Check console for debug output and errors

## Architecture

The extension follows a clean architecture pattern with clear separation of concerns:

- **Domain Layer**: Core business logic for YAML parsing and manipulation
- **Infrastructure Layer**: VS Code-specific implementations (tree view, webview)
- **Presentation Layer**: TypeScript-based webview with template rendering

### Key Technologies
- TypeScript with strict type checking
- VS Code Extension API
- YAML parsing and AST manipulation
- Template-based UI rendering
- Domain-driven design patterns

## Development Notes

This project was created through collaboration with Claude 3.5 Sonnet, an AI language model, demonstrating several key aspects of LLM-assisted development:

### AI-Assisted Development Process
- **Iterative refinement**: Features were developed incrementally with continuous feedback
- **Problem-solving approach**: Complex issues (like empty array handling) were identified and resolved systematically
- **Code quality focus**: Emphasis on TypeScript type safety, error handling, and professional architecture
- **Best practices integration**: Modern development patterns and VS Code extension standards were consistently applied

### Technical Achievements
- **Type-safe architecture**: Comprehensive TypeScript implementation with strict settings
- **Modular design**: Clean separation between domain logic and infrastructure
- **Robust error handling**: Multiple fallback systems and graceful degradation
- **Professional UI/UX**: Consistent with VS Code design standards

### Code Quality
- **Production-ready**: Comprehensive error handling and edge case management
- **Maintainable**: Clear architecture and extensive documentation
- **Extensible**: Modular design allows for easy feature additions
- **Testable**: Clean interfaces and dependency injection patterns

## Configuration

### Extension Settings
The extension activates automatically for .yaml and .yml files. No additional configuration is required.

### Development Settings
For optimal development experience, consider these VS Code settings:

```json
{
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "typescript.suggest.autoImports": true,
  "eslint.validate": ["typescript"]
}
```

## Contributing

### Getting Started
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes following the existing patterns
4. Test thoroughly in Extension Development Host
5. Submit a pull request

### Code Style
- TypeScript strict mode is enabled
- Follow domain-driven design patterns
- Maintain clean separation of concerns
- Include comprehensive error handling
- Write self-documenting code with appropriate comments

### Adding Features
- Follow existing architectural patterns
- Add TypeScript interfaces for all new data structures
- Update both tree view and webview functionality as needed
- Include appropriate error handling and user feedback
- Update documentation and tests

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- VS Code Extension API documentation and community
- YAML.js library for robust YAML parsing capabilities
- TypeScript team for excellent tooling and type safety
- Claude 3.5 Sonnet for AI-assisted development guidance

This project serves as an example of sophisticated VS Code extension development using modern TypeScript practices and AI-assisted development techniques.