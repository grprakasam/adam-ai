# ADAM AI Code Generator - React + TypeScript Frontend

## Overview

A professional, clean, and modern React + TypeScript frontend for the ADAM AI Code Generator. Built with Vite, Ant Design, and Monaco Editor.

## ✨ Features

### Clean, Tab-Based UI
- **4 Organized Tabs**: Setup, Datasets, Variables, Rules
- **Reduced Visual Clutter**: Only one section visible at a time
- **Professional Design**: Modern indigo/purple gradient, soft colors, better spacing

### Core Functionality
- **Study Configuration**: Study metadata and generation options
- **Dataset Selection**: Grid-based SDTM dataset selector with required badges
- **Variable Selection**: Collapsible categories with search and dependency tracking
- **Rule Management**: CDISC ADAM implementation rules
- **Code Generation**: Monaco Editor with syntax highlighting for R/SAS
- **Validation Results**: Visual validation grid with pass/warning/error indicators
- **Quality Metrics**: Dashboard-style metrics cards
- **AI Chat Assistant**: Floating chat panel for guidance

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Backend FastAPI server running on port 8000

### Installation
```bash
cd frontend
npm install
```

### Development
```bash
npm run dev
```
Application will be available at http://localhost:5173

### Build for Production
```bash
npm run build
```

## 📁 Project Structure

```
frontend/
├── src/
│   ├── components/          # React components
│   │   ├── Header.tsx       # Top navigation with LLM selector
│   │   ├── LeftPanel.tsx    # Configuration panel with tabs
│   │   ├── RightPanel.tsx   # Code output and results
│   │   ├── ChatPanel.tsx    # Floating AI assistant
│   │   └── tabs/            # Tab components
│   │       ├── SetupTab.tsx        # Study metadata & options
│   │       ├── DatasetsTab.tsx     # SDTM dataset selection
│   │       ├── VariablesTab.tsx    # Variable selection
│   │       └── RulesTab.tsx        # CDISC rules
│   ├── services/            # API integration
│   │   └── api.ts           # Axios API client
│   ├── types/               # TypeScript definitions
│   │   └── index.ts         # Type definitions
│   ├── styles/              # Global styles
│   │   └── global.css       # Global CSS
│   ├── App.tsx              # Main app component
│   └── main.tsx             # Entry point
├── index.html               # HTML template
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
├── vite.config.ts           # Vite configuration
└── README.md                # This file
```

## 🎨 Design Improvements (vs Original Mockup)

### Layout
- **Fixed 380px left panel** (instead of 35%)
- **Tab-based navigation** (replaces scrolling sections)
- **Cleaner spacing** throughout
- **Professional color scheme** (indigo/purple)

### Components
- **Datasets**: 2-column grid (compact view)
- **Variables**: Search + collapsible categories
- **Code Editor**: Proper header with toolbar
- **Validation**: 2-column grid with icons
- **Metrics**: 4-column dashboard style
- **Chat**: Floating panel (bottom-right)

### Visual Polish
- Modern Inter/Segoe UI font
- Subtle shadows and hover effects
- Rounded corners (6-8px)
- Better scrollbars (6px width)
- Gradient buttons with transitions

## 🔌 API Integration

The frontend proxies API requests to the backend:
```
/api/* → http://localhost:8000/api/*
```

Configured in `vite.config.ts`:
```typescript
server: {
  port: 5173,
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    }
  }
}
```

## 🛠️ Technologies

- **React 18.2** - UI framework
- **TypeScript 5.2** - Type safety
- **Vite 5.0** - Build tool & dev server
- **Ant Design 5.12** - UI component library
- **Monaco Editor** - Code editor (VS Code engine)
- **Axios** - HTTP client

## 📦 Dependencies

### Core
- react, react-dom
- typescript
- vite

### UI Components
- antd (UI framework)
- @ant-design/icons (Icon library)

### Code Editor
- @monaco-editor/react (Monaco Editor wrapper)

### API Client
- axios

## 🎯 Current Implementation Status

### ✅ Completed
- [x] Project structure with Vite + React + TypeScript
- [x] All dependencies installed
- [x] Header component with LLM selector
- [x] Left panel with 4 tabs (Setup, Datasets, Variables, Rules)
- [x] Setup tab (Study metadata + generation options)
- [x] Datasets tab (SDTM dataset selection)
- [x] Variables tab (Variable selection with search & categories)
- [x] Rules tab (CDISC rule display)
- [x] Right panel with code editor (Monaco)
- [x] Validation results display
- [x] Quality metrics dashboard
- [x] Derivation sequence display
- [x] Floating AI chat panel
- [x] Responsive design with proper styling
- [x] Both servers running (Frontend: 5173, Backend: 8000)

### 🔄 Ready for Backend Integration
- Code generation API call (simulated currently)
- Real-time validation from backend
- Chat AI integration with LLM
- File upload/download

## 🚦 Running Servers

### Backend (FastAPI)
```
URL: http://localhost:8000
Docs: http://localhost:8000/api/docs
Status: ✅ Running
```

### Frontend (React + Vite)
```
URL: http://localhost:5173
Status: ✅ Running
```

## 🔧 Development Tips

### Hot Module Replacement
Vite provides instant HMR - changes appear immediately without full page reload.

### Type Checking
```bash
npm run lint    # ESLint
tsc --noEmit    # TypeScript type checking
```

### Building
```bash
npm run build   # Production build → dist/
npm run preview # Preview production build
```

## 🎨 Customization

### Colors
Main theme colors in components use:
- Primary: `#4f46e5` (indigo-600)
- Secondary: `#7c3aed` (purple-600)
- Success: `#16a34a` (green-600)
- Warning: `#ca8a04` (yellow-600)
- Error: `#dc2626` (red-600)

### Ant Design Theme
Configured in `App.tsx`:
```typescript
<ConfigProvider
  theme={{
    token: {
      colorPrimary: '#4f46e5',
      borderRadius: 6,
    },
  }}
>
```

## 📝 Next Steps

1. **Connect to Backend API**
   - Replace simulated code generation with real API calls
   - Implement file upload/download
   - Add WebSocket for streaming (optional)

2. **Enhanced Features**
   - Save/Load configurations
   - Code diff viewer
   - Export documentation
   - User preferences

3. **Testing**
   - Unit tests with Vitest
   - Component tests with Testing Library
   - E2E tests with Playwright

## 📄 License

Part of ADAM AI Code Generator project.

## 👥 Author

Created as part of the ADAM AI Code Generator initiative for automated CDISC ADAM dataset code generation.
