#!/usr/bin/env node
// migration.js - CommonJS style, async I/O
const fs = require('fs').promises;
const path = require('path');
function sanitizeFilename(rawTitle) {
  // Remove characters not suitable for filenames, then replace spaces with underscores
  const noBad = rawTitle.replace(/[^\w\s-]/g, '');
  return noBad.trim().replace(/\s+/g, '_');
}
function toNumber(v) {
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}
function extractTimestamp(conv) {
  if (conv.update_time != null) return toNumber(conv.update_time);
  if (conv.create_time != null) return toNumber(conv.create_time);
  return 0;
}
function formatDateFromTimestamp(ts) {
  const dt = new Date(ts * 1000); // ts is in seconds
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}
async function main() {
  let inputJsonPath = 'conversations.json';
  let outputDir = null;
  if (process.argv.length > 2) {
    inputJsonPath = process.argv[2];
  }
  if (process.argv.length > 3) {
    outputDir = process.argv[3];
  }

  const inputPath = path.isAbsolute(inputJsonPath)
    ? inputJsonPath
    : path.resolve(inputJsonPath);
  let raw;
  try {
    raw = await fs.readFile(inputPath, 'utf8');
  } catch (err) {
    console.error(`Error reading input file ${inputPath}: ${err.message}`);
    process.exit(1);
  }
  let conversations;
  try {
    conversations = JSON.parse(raw);
  } catch (err) {
    console.error(`Invalid JSON in ${inputPath}: ${err.message}`);
    process.exit(1);
  }
  // Validate it's an array
  if (!Array.isArray(conversations)) {
    console.error(`Expected an array of conversations in ${inputPath}`);
    process.exit(1);
  }
  // Sort newest first
  conversations.sort((a, b) => extractTimestamp(b) - extractTimestamp(a));
  // Output folder side-by-side with script or custom outputDir
  const outputFolder = outputDir || path.join(__dirname, 'conversations');
  try {
    await fs.access(outputFolder);
  } catch {
    await fs.mkdir(outputFolder, { recursive: true });
  }
  for (const conv of conversations) {
    const ts = extractTimestamp(conv);
    const dateStr = formatDateFromTimestamp(ts);
    const rawTitle = conv.title || 'untitled';
    const cleanTitle = sanitizeFilename(rawTitle);
    const filename = `${dateStr}_${cleanTitle}.json`;
    const filepath = path.join(outputFolder, filename);
    await fs.writeFile(filepath, JSON.stringify(conv, null, 2), 'utf8');
  }
}
// Ensure the script runs only when executed directly, not when imported
if (require.main === module) {
  main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
