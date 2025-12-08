#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Generate Release Notes from Git Commits
 *
 * This script generates release notes by analyzing git commits since the last tag.
 * It's designed to be used by GitHub Actions workflows.
 *
 * Usage: node scripts/generate-release-notes.js [from-tag] [to-tag]
 */

const { execSync } = require('child_process');
const fs = require('fs');

// Get command line arguments
const args = process.argv.slice(2);
const fromTag = args[0];
const toTag = args[1] || 'HEAD';

function getGitCommits(from, to) {
  try {
    const cmd = `git log ${from}..${to} --pretty=format:"%h|%s|%an|%ad" --date=short`;
    const output = execSync(cmd, { encoding: 'utf8' });
    return output
      .trim()
      .split('\n')
      .filter(line => line);
  } catch (error) {
    console.error('Error getting git commits:', error.message);
    return [];
  }
}

function categorizeCommits(commits) {
  const categories = {
    '🚀 Features': [],
    '🐛 Bug Fixes': [],
    '🔧 Improvements': [],
    '📝 Documentation': [],
    '⚡ Performance': [],
    '🔒 Security': [],
    '🧹 Cleanup': [],
    '🔀 Other': [],
  };

  commits.forEach(commit => {
    const [hash, message, author, date] = commit.split('|');

    let category = '🔀 Other';
    const lowerMessage = message.toLowerCase();

    if (
      lowerMessage.includes('feat') ||
      lowerMessage.includes('add') ||
      lowerMessage.includes('new')
    ) {
      category = '🚀 Features';
    } else if (
      lowerMessage.includes('fix') ||
      lowerMessage.includes('bug') ||
      lowerMessage.includes('issue')
    ) {
      category = '🐛 Bug Fixes';
    } else if (
      lowerMessage.includes('improve') ||
      lowerMessage.includes('update') ||
      lowerMessage.includes('enhance')
    ) {
      category = '🔧 Improvements';
    } else if (
      lowerMessage.includes('doc') ||
      lowerMessage.includes('readme') ||
      lowerMessage.includes('changelog')
    ) {
      category = '📝 Documentation';
    } else if (
      lowerMessage.includes('perf') ||
      lowerMessage.includes('speed') ||
      lowerMessage.includes('optimize')
    ) {
      category = '⚡ Performance';
    } else if (
      lowerMessage.includes('security') ||
      lowerMessage.includes('vulnerability') ||
      lowerMessage.includes('csp')
    ) {
      category = '🔒 Security';
    } else if (
      lowerMessage.includes('clean') ||
      lowerMessage.includes('remove') ||
      lowerMessage.includes('delete')
    ) {
      category = '🧹 Cleanup';
    }

    categories[category].push({ hash, message, author, date });
  });

  return categories;
}

function formatReleaseNotes(categories, version) {
  let notes = `## 🎉 Release v${version}\n\n`;

  Object.entries(categories).forEach(([category, commits]) => {
    if (commits.length > 0) {
      notes += `### ${category}\n\n`;
      commits.forEach(commit => {
        notes += `- ${commit.message} (${commit.hash})\n`;
      });
      notes += '\n';
    }
  });

  return notes;
}

function generateReleaseNotes() {
  try {
    // Get latest tag if fromTag not provided
    let latestTag = fromTag;
    if (!latestTag) {
      try {
        latestTag = execSync('git describe --tags --abbrev=0', {
          encoding: 'utf8',
        }).trim();
      } catch (error) {
        latestTag = 'HEAD~10'; // Fallback to last 10 commits
        throw new Error(error);
      }
    }

    console.log(`Generating release notes from ${latestTag} to ${toTag}`);

    const commits = getGitCommits(latestTag, toTag);
    console.log(`Found ${commits.length} commits`);

    if (commits.length === 0) {
      console.log('No commits found, generating basic release notes');
      return `## 🎉 Release\n\nNo changes since last release.\n`;
    }

    const categories = categorizeCommits(commits);
    const version = toTag === 'HEAD' ? 'latest' : toTag.replace('v', '');
    const notes = formatReleaseNotes(categories, version);

    // Save to file for GitHub Actions
    fs.writeFileSync('release-notes.md', notes);
    console.log('Release notes saved to release-notes.md');
    console.log(notes);

    return notes;
  } catch (error) {
    console.error('Error generating release notes:', error.message);
    process.exit(1);
  }
}

// Run the function
if (require.main === module) {
  generateReleaseNotes();
}

module.exports = { generateReleaseNotes };
