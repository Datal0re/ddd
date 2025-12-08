# Data Dumpster Diver - Alpha Release Checklist

## 🚀 Pre-Release Checklist

### ✅ Code Quality

- [ ] **Linting**: Run `npm run lint` - no errors or warnings
- [ ] **Formatting**: Run `npm run format:check` - code properly formatted
- [ ] **Dependencies**: All packages up to date (`npm outdated`)
- [ ] **Security**: No known security vulnerabilities (`npm audit`)

### ✅ Functionality Tests

- [ ] **Application Startup**: Electron app launches without errors
- [ ] **API Server**: Express server starts on port 3001
- [ ] **Health Check**: `/api/health` endpoint responds correctly
- [ ] **File Upload**: Test with valid and invalid ZIP files
- [ ] **Data Processing**: Verify conversation extraction works
- [ ] **Media Display**: Test image and file rendering
- [ ] **Search**: Verify conversation search functionality
- [ ] **Navigation**: Test all UI navigation elements
- [ ] **Error Handling**: Test error scenarios and recovery

### ✅ Build Verification

- [ ] **Clean Build**: Remove old `dist/` directory
- [ ] **macOS Build**: `npm run build-mac` completes successfully
- [ ] **Windows Build**: `npm run build-win` completes successfully
- [ ] **Linux Build**: `npm run build-linux` completes successfully
- [ ] **Build Artifacts**: Verify all expected files are created
- [ ] **File Sizes**: Check build sizes are reasonable

### ✅ Documentation

- [ ] **Version Number**: Update to new version in package.json
- [ ] **CHANGELOG.md**: Add new version entry with changes
- [ ] **Release Summary**: Update alpha release summary
- [ ] **README.md**: Update if needed
- [ ] **AGENTS.md**: Update if architecture changed

---

## 📦 Release Process

### Step 1: Preparation

```bash
# Ensure clean working directory
git status
git pull origin main

# Install latest dependencies
npm ci

# Run code quality checks
npm run lint-and-fix
```

### Step 2: Testing

```bash
# Test application in development mode
npm run dev-full

# Test individual components if needed
npm run web  # Test API server only
npm start    # Test Electron app only
```

### Step 3: Release Automation

```bash
# Run the automated release script
npm run alpha-release

# Or run with specific options
npm run alpha-release -- --commit --tag
npm run alpha-release -- --skip-tests --platform mac
```

### Step 4: Manual Verification

```bash
# Check build artifacts
ls -la dist/

# Test built application (optional)
open dist/*.dmg  # macOS
```

### Step 5: Git Operations (if not automated)

```bash
# Commit changes
git add .
git commit -m "Alpha release v1.0.6-alpha"

# Create tag
git tag -a v1.0.6-alpha -m "Alpha release v1.0.6-alpha"

# Push to remote
git push origin main
git push origin v1.0.6-alpha
```

---

## 🔧 VS Code Tasks

Use the VS Code task runner for quick access:

1. **Ctrl+Shift+P** (or **Cmd+Shift+P** on Mac)
2. Type "Tasks: Run Task"
3. Select from available tasks:
   - **Alpha Release** - Complete automated release
   - **Build All Platforms** - Build for all platforms
   - **Pre-Release Checks** - Run linting and formatting
   - **Test Application** - Launch in development mode
   - **Clean Build** - Remove previous build artifacts

---

## 🐛 Troubleshooting

### Common Issues

#### Build Failures

```bash
# Clean node_modules and reinstall
rm -rf node_modules package-lock.json
npm ci

# Check Electron Builder configuration
npm run build -- --publish=never
```

#### Linting Errors

```bash
# Auto-fix linting issues
npm run lint:fix

# Check specific files
npx eslint utils/SessionManager.js
```

#### Version Conflicts

```bash
# Check current version
node -e "console.log(require('./package.json').version)"

# Manually update if needed
npm version patch --no-git-tag-version
```

#### Git Issues

```bash
# Check git status
git status

# Stash changes if needed
git stash

# Force push tags (careful!)
git push origin v1.0.6-alpha --force
```

### Debug Mode

Use VS Code launch configurations for debugging:

1. **Debug Release Script** - Test release automation
2. **Debug Version Update** - Test version bumping
3. **Debug Full Development** - Launch app with debugging

---

## 📋 Post-Release Tasks

### Distribution

- [ ] **Upload builds** to distribution platform
- [ ] **Test downloaded builds** on clean systems
- [ ] **Create release notes** for distribution
- [ ] **Notify alpha testers** with download links

### Monitoring

- [ ] **Track download metrics**
- [ ] **Monitor bug reports**
- [ ] **Collect user feedback**
- [ ] **Document issues** for next release

### Next Release Planning

- [ ] **Review feedback** from alpha testers
- [ ] **Prioritize bug fixes** and feature requests
- [ ] **Update roadmap** based on testing results
- [ ] **Schedule next release** timeline

---

## 🎯 Release Criteria

### Alpha Release Ready When:

- ✅ All pre-release checks pass
- ✅ No critical bugs blocking basic functionality
- ✅ Build process works for all target platforms
- ✅ Documentation is updated and accurate
- ✅ Core features work as expected
- ✅ Error handling is robust
- ✅ Performance is acceptable for target use cases

### Do Not Release If:

- ❌ Application fails to start
- ❌ Core functionality is broken
- ❌ Build process fails for any platform
- ❌ Security vulnerabilities are present
- ❌ Critical data loss bugs exist
- ❌ Performance makes app unusable

---

## 📞 Support

For issues with the release process:

1. **Check this checklist** for common solutions
2. **Review build logs** for specific error messages
3. **Consult AGENTS.md** for architecture details
4. **Check CHANGELOG.md** for recent changes
5. **Test in clean environment** to isolate issues

---

**Last Updated**: December 8, 2025  
**Version**: 1.0.5-alpha  
**Next Target**: 1.0.6-alpha
