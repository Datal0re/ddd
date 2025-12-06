# AGENTS.md

## **Build/Lint/Test**

- Install deps: `npm ci`
- Lint: `npm run lint` (ESLint v9+ with flat config)
- Lint & Fix: `npm run lint:fix` (auto-fixable ESLint issues)
- Format: `npm run format` (Prettier with 88 char line length)
- Format Check: `npm run format:check` (check formatting without changes)
- Full Cleanup: `npm run lint-and-fix` (runs lint:fix + format)
- Test: `npm test` (currently not configured)
- Single test:
  - Jest: `npx jest path/to/file.test.js -t 'test name'`
  - Vitest: `npx vitest path/to/file.test.js -t 'test name'`
- Build: `npm run build` if script exists

## **Code Style**

- Imports: standard order (builtin, third-party, local), explicit, no wildcards
- Formatting: Prettier (88 char line length), trailing commas, consistent multi-line formatting
- Types/Naming: Prefer TypeScript; JS uses JSDoc. snake_case for data, camelCase for functions, PascalCase for classes
- Error handling: Precise errors, avoid bare `catch`, validate inputs early
- Docs: Public APIs with docstrings/comments; keep README/docs synced
- Testing: Core utilities and edge cases, fast/deterministic tests

## **Rules Visibility**

- Cursor Rules: None detected (check `.cursor/rules/` or `.cursorrules`)
- Copilot Rules: None detected (check `.github/copilot-instructions.md`)
- ESLint Config: `eslint.config.mjs` (flat config format)
- Prettier Config: `.prettierrc.json`
- Markdown Linting: Use `davidanson.vscode-markdownlint` extension in VS Code for markdown documentation

## **Project-Specific Scripts**

- Start Electron app: `npm start` or `npm run dev`
- Start web server: `npm run web` (API_PORT=3001)
- Full development: `npm run dev-full` (web server + Electron)
- Data migration: `npm run migrate` (migrates conversation data)

## **Notes**

- Workspace is a git repo; commit via usual workflow.
- Project uses CommonJS modules (`"type": "commonjs"` in package.json)
- ESLint config uses `.mjs` extension due to CommonJS project type
- Both `.js` and `.mjs` files are linted
