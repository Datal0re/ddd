const js = require('@eslint/js');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        global: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    rules: {
      'linebreak-style': ['error', 'unix'],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // 'no-console': 'warn',
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  prettierConfig, // Must be last to disable conflicting ESLint rules
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**', '*.min.js', 'coverage/**'],
  },
];
