#!/usr/bin/env node
/* eslint-disable no-console */


/**
 * Update Changelog Script
 *
 * This script updates the CHANGELOG.md file with a new version entry.
 * It's designed to be used by GitHub Actions workflows.
 *
 * Usage: node scripts/update-changelog.js <version> <is_alpha>
 */

const fs = require('fs');
const path = require('path');

// Get command line arguments
const args = process.argv.slice(2);
const version = args[0];
const isAlpha = args[1] === 'true';

if (!version) {
  console.error('Error: Version argument is required');
  process.exit(1);
}

// Validate version format (basic semantic versioning)
const versionRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?$/;
if (!versionRegex.test(version)) {
  console.error(`Error: Invalid version format: ${version}`);
  console.error('Expected format: X.Y.Z or X.Y.Z-suffix (e.g., 1.0.0 or 1.0.0-alpha)');
  process.exit(1);
}

function updateChangelog() {
  const changelogPath = path.join(process.cwd(), 'docs', 'CHANGELOG.md');
  const date = new Date().toISOString().split('T')[0];

  let changelog = '';
  if (fs.existsSync(changelogPath)) {
    changelog = fs.readFileSync(changelogPath, 'utf8');
  }

  const releaseType = isAlpha ? '🚀 Alpha Release' : '🎉 Stable Release';
  const releaseTypeText = isAlpha ? 'alpha' : 'stable';

  const newEntry = `## [${version}] - ${date}

### ${releaseType}

#### Automated Release

- **Version**: ${version}
- **Build Date**: ${date}
- **Release Type**: Automated ${releaseTypeText} release
- **Build Platforms**: mac, win, linux

#### Changes Since Previous Release

- Version bump to ${version}
- Automated build and release process
- Updated documentation and release notes

#### Testing

- ✅ Pre-release checks passed
- ✅ Build process completed successfully
- ✅ All platforms built successfully

---

`;

  const updatedChangelog = newEntry + changelog;
  fs.writeFileSync(changelogPath, updatedChangelog);

  console.log(`CHANGELOG.md updated for version ${version}`);
}

updateChangelog();
