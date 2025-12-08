# GitHub Release Automation Guide

This document explains the automated release process for Data Dumpster Diver using GitHub Actions.

## 🚀 Overview

The project uses GitHub Actions to automate the complete release process, including:

- Code quality checks
- Multi-platform builds (macOS, Windows, Linux)
- Version management
- GitHub release creation
- Artifact management

## 📋 Available Workflows

### 1. Main Release Workflow (`release.yml`)

**Triggers:**

- Push to version tags (e.g., `v1.0.0`)
- Manual dispatch from GitHub Actions tab

**Features:**

- Automated version bumping
- Multi-platform builds in parallel
- GitHub release creation with proper assets
- Changelog updates
- Alpha release summary updates

**Release Types:**

- **Stable**: Clean version numbers (e.g., `1.0.0`)
- **Beta**: Version with `-beta` suffix (e.g., `1.0.1-beta`)
- **Alpha**: Version with `-alpha` suffix (e.g., `1.0.2-alpha`)

### 2. Alpha Release Workflow (`alpha-release.yml`)

**Triggers:**

- Manual dispatch only

**Features:**

- Uses existing alpha release script
- Configurable version bumping
- Optional pre-release checks
- Git tag creation
- GitHub release as prerelease

### 3. CI Workflow (`ci.yml`)

**Triggers:**

- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

**Features:**

- Code quality checks (ESLint, Prettier)
- Application health checks
- Build testing across platforms
- Security scanning
- Documentation validation
- Performance monitoring

## 🛠️ Usage Instructions

### Creating a Stable Release

1. **Via Git Tag (Recommended):**

   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```

2. **Via Manual Dispatch:**
   - Go to Actions tab in GitHub
   - Select "Release" workflow
   - Click "Run workflow"
   - Choose "stable" as release type
   - Select version bump type
   - Enable git tag creation

### Creating an Alpha Release

1. **Via Manual Dispatch:**
   - Go to Actions tab in GitHub
   - Select "Alpha Release" workflow
   - Click "Run workflow"
   - Choose version bump type
   - Configure options as needed

2. **Via Local Script:**
   ```bash
   npm run release:alpha
   ```

### Creating a Beta Release

1. **Via Manual Dispatch:**
   - Go to Actions tab in GitHub
   - Select "Release" workflow
   - Click "Run workflow"
   - Choose "beta" as release type
   - Select version bump type

## 📦 Build Artifacts

The workflows generate the following artifacts:

### macOS

- `DDD-{version}.dmg` (Intel x64)
- `DDD-{version}-arm64.dmg` (Apple Silicon)

### Windows

- `DDD Setup {version}.exe` (x64 installer)

### Linux

- `DDD-{version}.AppImage` (x64)

## 🔧 Configuration

### Environment Variables

- `NODE_VERSION`: Node.js version (default: '20')
- `CACHE_VERSION`: Cache version for dependency caching

### Required Secrets

- `GITHUB_TOKEN`: Automatically provided by GitHub Actions
- Optional: Code signing certificates for production releases

### Workflow Parameters

**Release Workflow:**

- `release_type`: stable, beta, alpha
- `version_bump`: patch, minor, major
- `create_git_tag`: boolean (default: true)

**Alpha Release Workflow:**

- `version_bump`: patch, minor, major
- `create_git_tag`: boolean (default: true)
- `skip_tests`: boolean (default: false)

## 📝 Release Process Flow

### Stable Release (Tag-based)

1. Git tag pushed to repository
2. Quality checks run (lint, format)
3. Version extracted from tag
4. Multi-platform builds execute in parallel
5. Artifacts uploaded to GitHub release
6. Release notes generated automatically

### Manual Release

1. User triggers workflow manually
2. Quality checks run (if not skipped)
3. Version calculated based on bump type
4. Package.json updated
5. Changelog updated
6. Git commit and tag created (if enabled)
7. Multi-platform builds execute
8. GitHub release created

### Alpha Release

1. User triggers alpha release workflow
2. Pre-release checks run (if not skipped)
3. Alpha release script executed
4. Build artifacts created
5. GitHub release created as prerelease
6. Alpha summary updated

## 🔄 Local Development Scripts

The following npm scripts are available for local development:

```bash
# Run full CI pipeline locally
npm run ci

# Run extended CI with all builds
npm run ci-full

# Create alpha release locally
npm run release:alpha

# Create stable release locally
npm run release:stable

# Update changelog manually
npm run update-changelog <version> <is_alpha>

# Update alpha summary manually
npm run update-alpha-summary <version> <date>

# Generate release notes from git commits
npm run generate-release-notes [from-tag] [to-tag]
```

## 🐛 Troubleshooting

### Common Issues

1. **Build Failures:**
   - Check that all dependencies are installed
   - Verify Node.js version compatibility
   - Review build logs for specific errors

2. **Permission Issues:**
   - Ensure GITHUB_TOKEN has proper permissions
   - Check repository settings for Actions permissions

3. **Version Conflicts:**
   - Verify version format follows semantic versioning
   - Check for existing tags with same version

4. **Artifact Upload Failures:**
   - Check file size limits
   - Verify artifact paths are correct
   - Ensure build completed successfully

### Debugging Steps

1. **Check Workflow Logs:**
   - Go to Actions tab in GitHub
   - Click on the specific workflow run
   - Review each job's logs

2. **Local Testing:**

   ```bash
   # Test build process locally
   npm run build-all

   # Test quality checks
   npm run lint-and-fix
   ```

3. **Manual Version Bump:**
   ```bash
   npm version patch  # or minor/major
   ```

## 📊 Monitoring

### Workflow Status

- All workflows create detailed summaries
- CI workflow provides comprehensive status reports
- Release workflows generate artifact information

### Release Tracking

- GitHub releases page shows all releases
- Changelog.md tracks version history
- Alpha release summary tracks testing status

## 🔐 Security Considerations

- No sensitive data in workflow files
- Code signing certificates should be stored as secrets
- Artifact uploads use secure GitHub infrastructure
- Dependency scanning included in CI pipeline

## 🚀 Future Enhancements

Potential improvements to consider:

1. **Automated Testing:**
   - Unit test integration
   - End-to-end testing
   - Performance benchmarking

2. **Distribution:**
   - Homebrew cask for macOS
   - Chocolatey package for Windows
   - Snap package for Linux

3. **Notifications:**
   - Slack/Discord notifications on releases
   - Email notifications for failed builds
   - Status badges for README

4. **Advanced Features:**
   - Automatic dependency updates
   - Release candidate (RC) workflow
   - Automated release notes from git commits ✅ (Implemented)
   - Rollback mechanisms ✅ (Implemented)

---

## 📞 Support

For questions or issues with the release automation:

1. Check this documentation first
2. Review workflow logs in GitHub Actions
3. Test locally using provided npm scripts
4. Create an issue in the repository with details

**Happy Releasing! 🎉**
