# Cendex — Project Documentation

## Project Overview
Cendex is a React-based chat interface application built with TypeScript. It features a modular architecture using React Context for state management, a custom theme system, and a multi-screen layout. The application is designed to handle multiple chat sessions, AI model selection, and integrates client-side UI with server-side tooling.

## Technology Stack
- **Frontend**: React, TypeScript
- **State Management**: React Context API (Provider pattern)
- **Styling**: Centralized design tokens via `theme.ts`
- **Tooling**: Custom plugin harness and file handling utilities

## Directory Structure
```text
src/
├── index.tsx                 # Application entry point
├── providers/                # Global state management
│   ├── DialogProvider/       # Modal and dialog system
│   ├── ModelProvider.tsx     # AI model selection state
│   └── ToastProvider.tsx     # Notification system
├── layouts/                  # Structural components
│   ├── RootLayout.tsx        # Main UI shell and provider wrapper
│   └── screens/              # Application views (Home, NewSession)
├── components/               # Reusable UI elements
│   ├── Message/              # Chat message rendering
│   ├── StatusBar/            # Connection and status display
│   ├── Header.tsx            # Navigation header
│   ├── ScrollablePicker/     # Custom wheel-style selector
│   ├── InputBar/             # User input handling
│   └── Menu/                 # Command and action system
├── tools/                    # Backend/Utility integration
│   ├── harness-plugin-core.ts # Plugin system core
│   ├── tools.ts              # Tool implementations
│   └── fileHandler.ts        # File system operations
└── server/                   # Server-side logic
    └── Models.ts             # Model metadata and configuration
```

## Core Architecture

### State Management (Providers)
- **DialogProvider**: Manages the lifecycle and rendering of application-wide modals and dialogs.
- **ModelProvider**: Tracks the currently selected AI model and provides selection logic to the UI.
- **ToastProvider**: Handles a queue of transient notifications (toasts) for user feedback.

### Layout & Navigation
- **RootLayout**: The top-level component that wraps the application in necessary providers and defines the global visual structure.
- **Screens**:
    - `Home.tsx`: The primary dashboard showing active sessions and status.
    - `NewSession.tsx`: Interface for configuring and starting new chat interactions.

### UI Components
- **Menu System**: A command-driven menu (`src/components/Menu/`) that handles user actions and application commands defined in `commands.tsx`.
- **InputBar**: A sophisticated input component that handles text entry, submission logic, and visual styling.
- **ScrollablePicker**: A specialized UI component for selecting items (like models or sessions) using a scrollable wheel interface.

### Tools & Server Integration
- **Plugin Harness**: Located in `src/tools/`, this provides the infrastructure for extending application functionality.
- **File Handler**: Manages I/O operations, allowing the application to interact with local or remote file systems.
- **Models Configuration**: `src/server/Models.ts` acts as the source of truth for available AI models and their capabilities.

## Key Features
1. **Modular Provider Pattern**: Decoupled state logic for dialogs, notifications, and settings.
2. **Command-Based Menu**: Extensible action system for navigating and controlling the app.
3. **Custom Theme System**: Centralized styling tokens in `theme.ts` for consistent UI/UX.
4. **Session Management**: Support for creating, viewing, and switching between multiple chat sessions.
5. **Extensible Tooling**: Built-in support for plugins and file-based operations.

## Configuration Files
- `theme.ts`: Defines colors, spacing, and typography.
- `tsconfig.json`: TypeScript compiler settings.
- `package.json`: Project dependencies and scripts.
- `.env.local`: Environment-specific variables.