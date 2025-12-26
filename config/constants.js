/*
 * Centralized configuration constants
 * Contains all configuration values used across the application
 */

// Security and performance constants
const LIMITS = {
  MAX_UPLOAD_SIZE: 500 * 1024 * 1024, // 500MB limit
  MAX_EXTRACTED_SIZE: 2 * 1024 * 1024 * 1024, // 2GB extracted limit
  MAX_COMPRESSION_RATIO: 100, // Maximum allowed compression ratio (100:1)
  MAX_FILES_IN_ZIP: 10000, // Maximum number of files in a zip
};

// File extension constants
const FILE_EXTENSIONS = {
  AUDIO: ['.wav', '.mp3', '.m4a', '.dat'],
  IMAGE: ['.webp', '.png', '.jpg', '.jpeg'],
  VIDEO: ['.mp4', '.webm', '.mov'],
};

// Content type constants
const CONTENT_TYPES = {
  IMAGE: 'image_asset_pointer',
  AUDIO: 'audio_asset_pointer',
  VIDEO: 'video_container_asset_pointer',
  TRANSCRIPTION: 'audio_transcription',
};

// Asset pointer prefixes
const ASSET_PREFIXES = {
  FILE_SERVICE: 'file-service://',
  SEDIMENT: 'sediment://',
};

// Path constants
const PATHS = {
  DATA_DIR: 'data',
  DUMPSTERS_DIR: 'data/dumpsters',
  TEMP_DIR: 'data/temp',
  MEDIA_DIR: 'media',
  CHATS_DIR: 'chats',
};

// ZIP file signatures for validation
const ZIP_SIGNATURES = [
  Buffer.from([0x50, 0x4b, 0x03, 0x04]), // ZIP
  Buffer.from([0x50, 0x4b, 0x05, 0x06]), // ZIP
  Buffer.from([0x50, 0x4b, 0x07, 0x08]), // ZIP
];

// Media file patterns for detection
const MEDIA_PATTERNS = [
  /^file-/, // ChatGPT file attachments
  /^audio\//, // Audio files
  /^dalle-generations\//, // DALL-E images
  /\.(jpeg|jpg|png|gif|webp)$/i, // Image extensions
  /\.(dat|wav|mp3|m4a|ogg)$/i, // Audio extensions
];

// Progress stages
const PROGRESS_STAGES = {
  INITIALIZING: 'initializing',
  EXTRACTING: 'extracting',
  DUMPING: 'dumping',
  EXTRACTING_ASSETS: 'extracting-assets',
  ORGANIZING: 'organizing',
  VALIDATING: 'validating',
  COMPLETED: 'completed',
};

// Sanitization defaults
const SANITIZATION_DEFAULTS = {
  DUMPSTER: {
    maxLength: 50,
    caseTransform: 'lower',
    spaceReplacement: '_',
    allowPrefixNumbers: false,
  },
  EXPORT: {
    maxLength: 50,
    caseTransform: 'none',
    spaceReplacement: ' ',
    allowPrefixNumbers: true,
  },
  FILENAME: {
    maxLength: 100,
    caseTransform: 'none',
    spaceReplacement: '_',
    allowPrefixNumbers: true,
  },
};

// Temporary directory configuration
const TEMP_CONFIG = {
  PREFIX: 'dddiver-',
  BYTES_LENGTH: 8, // Length of random bytes for temp dir names
};

// File search configuration
const SEARCH_CONFIG = {
  DEFAULT_MAX_DEPTH: Infinity,
  MAX_CACHE_SIZE: 1000, // For file search caching
};

/**
 * Validate configuration values
 * @throws {Error} If configuration is invalid
 */
function validateConfig() {
  // Validate limits are positive numbers
  Object.values(LIMITS).forEach(value => {
    if (typeof value !== 'number' || value <= 0) {
      throw new Error(`Invalid LIMITS configuration: values must be positive numbers`);
    }
  });

  // Validate temp config
  if (typeof TEMP_CONFIG.BYTES_LENGTH !== 'number' || TEMP_CONFIG.BYTES_LENGTH <= 0) {
    throw new Error(`Invalid TEMP_CONFIG.BYTES_LENGTH: must be positive number`);
  }

  // Validate search config
  if (
    typeof SEARCH_CONFIG.MAX_CACHE_SIZE !== 'number' ||
    SEARCH_CONFIG.MAX_CACHE_SIZE <= 0
  ) {
    throw new Error(`Invalid SEARCH_CONFIG.MAX_CACHE_SIZE: must be positive number`);
  }

  // Validate required arrays are not empty
  if (!Array.isArray(FILE_EXTENSIONS.IMAGE) || FILE_EXTENSIONS.IMAGE.length === 0) {
    throw new Error(`Invalid FILE_EXTENSIONS.IMAGE: must be non-empty array`);
  }

  if (!Array.isArray(ZIP_SIGNATURES) || ZIP_SIGNATURES.length === 0) {
    throw new Error(`Invalid ZIP_SIGNATURES: must be non-empty array`);
  }
}

// Perform validation when module is loaded
validateConfig();

module.exports = {
  LIMITS,
  FILE_EXTENSIONS,
  CONTENT_TYPES,
  ASSET_PREFIXES,
  PATHS,
  ZIP_SIGNATURES,
  MEDIA_PATTERNS,
  PROGRESS_STAGES,
  SANITIZATION_DEFAULTS,
  TEMP_CONFIG,
  SEARCH_CONFIG,
};
