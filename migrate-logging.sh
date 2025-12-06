#!/bin/bash

# Migration script: Replace console.log with proper logging
# Usage: ./migrate-logging.sh

echo "🚀 Starting logging migration..."

# Step 1: Install dependencies
echo "📦 Installing logging dependencies..."
npm install electron-log pino pino-pretty

# Step 2: Create logger utility (already done)
echo "✅ Logger utility created"

# Step 3: Add ESLint rule to prevent console.log
echo "📋 Adding ESLint rule for console.log..."

# Create .eslintrc.json if it doesn't exist
if [ ! -f .eslintrc.json ]; then
  cat > .eslintrc.json << 'EOF'
{
  "rules": {
    "no-console": "warn"
  }
}
EOF
fi

# Step 4: Create migration helper script
cat > migrate-console-logs.js << 'EOF'
const fs = require('fs');
const path = require('path');

// Simple regex replacements for common console patterns
const replacements = [
  {
    pattern: /console\.log\(`([^`]+)`\);?/g,
    replacement: 'logger.info("$1");'
  },
  {
    pattern: /console\.log\('([^']+)'\);?/g,
    replacement: 'logger.info("$1");'
  },
  {
    pattern: /console\.error\(`([^`]+)`\);?/g,
    replacement: 'logger.error("$1");'
  },
  {
    pattern: /console\.error\('([^']+)'\);?/g,
    replacement: 'logger.error("$1");'
  },
  {
    pattern: /console\.warn\(`([^`]+)`\);?/g,
    replacement: 'logger.warn("$1");'
  },
  {
    pattern: /console\.warn\('([^']+)'\);?/g,
    replacement: 'logger.warn("$1");'
  }
];

const filesToMigrate = [
  'main.js',
  'app.js', 
  'utils/SessionManager.js',
  'utils/fileUtils.js',
  'utils/BackupManager.js',
  'data/migration.js',
  'renderer.js'
];

filesToMigrate.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`🔄 Migrating ${file}...`);
    let content = fs.readFileSync(file, 'utf8');
    
    // Add logger import at the top
    if (!content.includes('createLogger')) {
      content = content.replace(
        /const\s+.*require\(['"]electron['"]\);?/,
        (match) => match + '\nconst { createLogger } = require(\'./utils/logger\');\nconst logger = createLogger({ module: path.basename(__filename, \'.js\') });'
      );
    }
    
    // Apply replacements
    replacements.forEach(({ pattern, replacement }) => {
      content = content.replace(pattern, replacement);
    });
    
    fs.writeFileSync(file, content);
    console.log(`✅ ${file} migrated`);
  }
});

console.log('🎉 Basic migration complete!');
console.log('⚠️  Please review and manually fix complex console.log statements');
EOF

node migrate-console-logs.js

echo "🧹 Cleaning up migration script..."
rm migrate-console-logs.js

echo "✅ Migration setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Review the migrated files"
echo "2. Manually fix complex console.log statements"
echo "3. Test the application"
echo "4. Run: npm run lint-and-fix"
echo ""
echo "📁 Log files will be created in:"
echo "   - Electron: ~/Library/Logs/data-dumpster-diver/ (macOS)"
echo "   - Node.js: ./logs/ directory"