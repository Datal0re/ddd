# Local Testing Plan for Build Issues

## Purpose

Test and verify fixes for electron-builder `dmg-license` module error and release creation issues.

## Prerequisites

- Node.js installed locally
- Clean git working directory
- GitHub CLI installed and authenticated

## Testing Steps

### 1. Test Current Build Process

```bash
# Test current state
npm run build-mac

# Check for errors
echo "Exit code: $?"
```

### 2. Test npm install vs npm ci

```bash
# Clean state
rm -rf node_modules package-lock.json

# Test npm install
npm install
npm run build-mac

# Compare results
echo "npm install build completed successfully"
```

### 3. Verify Build Artifacts

```bash
# Check dist directory
ls -la dist/

# Verify specific files
find dist -name "*.dmg" -o -name "*.exe" -o -name "*.AppImage"
```

### 4. Test Dependencies

```bash
# Check electron-builder
npm list electron-builder

# Check dmg-builder specifically
npm list dmg-builder || echo "dmg-builder not found (expected)"

# Check all build-related packages
npm list | grep -E "(electron|builder|dmg)"
```

### 5. Test Release Script Locally

```bash
# Test alpha release script (dry run if possible)
node scripts/create-alpha-release.js --help

# Test version bumping
npm version patch --dry-run
```

## Expected Results

### ✅ Success Indicators

- Build completes without `dmg-license` errors
- All platform builds create artifacts
- Dependencies install correctly with `npm install`
- Release script runs without errors

### ❌ Failure Indicators

- `Cannot find module 'dmg-license'` error
- Build fails on macOS specifically
- Dependencies missing or corrupted
- Release script fails to execute

## Troubleshooting

### If Build Fails:

1. Check Node.js version compatibility
2. Verify Xcode command line tools (macOS)
3. Clear npm cache: `npm cache clean --force`
4. Delete node_modules and package-lock.json completely
5. Try with fresh npm install

### If Release Script Fails:

1. Check script permissions: `chmod +x scripts/*.js`
2. Verify Node.js version compatibility
3. Check for missing dependencies in scripts
4. Test individual script components

## Next Steps After Testing

1. **If tests pass**: Proceed with CI workflow changes
2. **If tests fail**: Debug specific issues locally first
3. **Document results**: Share testing outcomes for implementation plan
4. **Prepare CI changes**: Based on local test results

---

**Run these tests locally and share results before proceeding with CI changes!**
