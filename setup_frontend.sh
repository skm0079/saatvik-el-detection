#!/bin/bash
# file: setup_frontend.sh - Create complete frontend project structure

set -e  # Exit on any error

echo "🚀 Setting up Saatvik EL Detection Frontend..."

# Create main frontend directory
mkdir -p frontend

# Navigate to frontend directory
cd frontend

# Create source structure
mkdir -p src/{components,services,types,constants,hooks,assets,styles}

# Create component subdirectories
mkdir -p src/components/{common,layout}

# Create all necessary files with proper structure
touch src/main.tsx
touch src/App.tsx
touch src/index.html

# Types
touch src/types/index.ts

# Constants & Config
touch src/constants/config.ts

# Services
touch src/services/{api.ts,imageUtils.ts}

# Hooks
touch src/hooks/{useApi.ts,useDetections.ts}

# Components
touch src/components/{Dashboard.tsx,DetectionHistory.tsx,DetectionDetail.tsx}
touch src/components/common/{ImageViewer.tsx,LoadingSpinner.tsx,ErrorMessage.tsx}
touch src/components/layout/{Layout.tsx,Navigation.tsx}

# Styles
touch src/styles/{globals.css,components.css}

# Root config files
touch package.json
touch tsconfig.json
touch tsconfig.node.json
touch vite.config.ts
touch .gitignore
touch README.md

# Environment files
touch .env.development
touch .env.production

echo "📁 Frontend structure created:"
tree . || find . -type f -name "*.ts" -o -name "*.tsx" -o -name "*.json" -o -name "*.css" | sort

echo ""
echo "✅ Frontend project structure ready!"
echo ""
echo "📝 Next steps:"
echo "1. cd frontend"
echo "2. npm install (after package.json is configured)"
echo "3. npm run dev (for development)"
echo "4. npm run build (builds to ../app/static/)"
echo ""
echo "🎯 Ready for code implementation!"