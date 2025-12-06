/*
 * Common file utilities for session management
 * Eliminates code duplication between main.js and app.js
 */
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

// Dynamic import for decompress (ES module)
let decompress;
const getDecompress = async () => {
  if (!decompress) {
    const module = await import('decompress');
    decompress = module.default;
  }
  return decompress;
};

/**
 * Ensures a directory exists, creates it if it doesn't
 * @param {string} dirPath - Directory path to ensure exists
 */
async function ensureDir(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Runs migration script on a given conversations.json file
 * @param {string} sessionId - Session ID
 * @param {string} outputDir - Output directory for migrated conversations
 * @param {string} baseDir - Base directory of the application
 * @returns {Promise<void>}
 */
async function runMigration(sessionId, outputDir, baseDir) {
  const inputPath = path.join(baseDir, 'data', 'sessions', sessionId, 'conversations.json');
  await ensureDir(outputDir);
  
  return new Promise((resolve, reject) => {
    const child = spawn('node', [path.join(baseDir, 'data', 'migration.js'), inputPath, outputDir], {
      stdio: 'inherit',
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Migration exited with code ${code}`));
    });
  });
}

/**
 * Processes uploaded zip file and extracts conversations and media
 * @param {Buffer|string} zipData - Zip file buffer or path
 * @param {string} sessionId - Session ID
 * @param {string} sessionDir - Session directory path
 * @param {string} mediaDir - Media directory path
 * @param {boolean} isBuffer - True if zipData is buffer, false if path
 * @returns {Promise<string>} Path to conversations.json
 */
async function processZipUpload(zipData, sessionId, sessionDir, mediaDir, isBuffer = true) {
  const decompress = await getDecompress();
  const path = require('path');
  
  try {
    console.log(`Processing zip upload: isBuffer=${isBuffer}, sessionId=${sessionId}`);
    
    // Save or copy zip file
    const tempZipPath = path.join(sessionDir, 'upload.zip');
    if (isBuffer) {
      console.log('Writing buffer to temp file:', tempZipPath);
      await fs.writeFile(tempZipPath, zipData);
    } else {
      console.log('Copying file to temp location:', tempZipPath);
      await fs.copyFile(zipData, tempZipPath);
    }

    console.log('Starting zip extraction...');
    // Extract zip
    const files = await decompress(tempZipPath, sessionDir);
    
    console.log(`Extracted ${files.length} files:`, files.map(f => ({ path: f.path, type: f.type })));
    
    if (!files || files.length === 0) {
      console.error('No files extracted from zip archive');
      throw new Error('No files found in zip archive or extraction failed');
    }
    
    // Find conversations.json and detect top-level folder structure
    let conversationsPath = null;
    const topLevelDirs = new Set();
    
    for (const file of files) {
      const parts = file.path.split(path.sep);
      if (parts.length > 1) {
        topLevelDirs.add(parts[0]);
      }
    }
    
    console.log('Top-level directories found:', [...topLevelDirs]);
    
    const hasSingleTopLevel = topLevelDirs.size === 1;
    const topLevelFolder = hasSingleTopLevel ? [...topLevelDirs][0] : '';
    
    console.log('Has single top level:', hasSingleTopLevel);
    console.log('Top level folder:', topLevelFolder);
    
    // Process each file
    for (const file of files) {
      // Find conversations.json
      if (file.path.endsWith('conversations.json')) {
        const candidatePath = path.join(sessionDir, file.path);
        const stats = await fs.stat(candidatePath);
        if (stats.isFile()) {
          const sample = await fs.readFile(candidatePath, { encoding: 'utf8' });
          if (sample && !sample.includes('\u0000')) {
            conversationsPath = candidatePath;
          }
        }
      }
      
      // Copy media assets
      if ((file.path.startsWith('file-') || file.path.includes('audio/') || file.path.includes('dalle-generations/')) && !file.path.endsWith('/')) {
        const src = path.join(sessionDir, file.path);
        const relativePath = hasSingleTopLevel && file.path.startsWith(topLevelFolder + path.sep)
          ? file.path.slice((topLevelFolder + path.sep).length)
          : file.path;
        const destPath = path.join(mediaDir, relativePath);
        await ensureDir(path.dirname(destPath));
        await fs.copyFile(src, destPath);
      }
    }
    
    if (!conversationsPath) {
      throw new Error('conversations.json not found in uploaded zip.');
    }
    
    // Ensure conversations.json is at session root
    const targetConversationsPath = path.join(sessionDir, 'conversations.json');
    if (conversationsPath !== targetConversationsPath) {
      await fs.rename(conversationsPath, targetConversationsPath);
      conversationsPath = targetConversationsPath;
    }
    
    // Clean up nested directory if present
    if (hasSingleTopLevel && topLevelFolder) {
      const nestedDir = path.join(sessionDir, topLevelFolder);
      try {
        await fs.rmdir(nestedDir, { recursive: true });
      } catch (error) {
        console.warn(`Failed to delete nested directory ${nestedDir}:`, error.message);
      }
    }
    
    // Clean up temporary zip
    await fs.unlink(tempZipPath);
    
    return conversationsPath;
  } catch (error) {
    console.error('Zip upload processing failed:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    throw error;
  }
}

/**
 * Removes directories safely with error handling
 * @param {...string} dirs - Directory paths to remove
 */
async function removeDirectories(...dirs) {
  for (const dir of dirs) {
    try {
      await fs.rmdir(dir, { recursive: true });
    } catch (error) {
      // Ignore errors if directories don't exist
      if (error.code !== 'ENOENT') {
        console.warn(`Failed to remove directory ${dir}:`, error.message);
      }
    }
  }
}

module.exports = {
  ensureDir,
  runMigration,
  processZipUpload,
  removeDirectories
};