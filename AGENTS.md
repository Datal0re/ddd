This AGENTS.md provides guidelines for agentic work in this repository.

**Build/Lint/Test**
- Install deps: `npm ci` (or `npm install` if no lockfile).
- Lint: `npm run lint` (configure ESLint at root).
- Format: `npm run format` (configure Prettier at root).
- Test: `npm test` (unit/integration tests; adjust per framework).
- Run a single test (examples):
  - Jest: `npx jest path/to/file.test.js -t 'test name'`
  - Vitest: `npx vitest path/to/file.test.js -t 'test name'`
- Build: `npm run build` (if a build script exists).

**Code Style**
- Imports: standard ordering (builtin, third-party, local); explicit imports; no wildcard.
- Formatting: prefer Prettier (88 char line length); trailing commas; consistent multi-line formatting.
- Types/Naming: TypeScript preferred; if JS, use JSDoc; snake_case for data, camelCase for functions, PascalCase for classes.
- Error handling: throw/return precise errors; avoid bare `catch`; include clear messages; validate inputs early.
- Documentation: docstrings/comments for public APIs; keep README/docs in sync with code.
- Testing: add tests for core utilities and edge cases; keep tests fast and deterministic.

**Rules Visibility**
- Cursor Rules: none detected (look for `.cursor/rules/` or `.cursorrules`).
- Copilot Rules: none detected (look for `.github/copilot-instructions.md`).

**Notes**
- This workspace is not guaranteed to be a git repo in all environments; commit via your usual workflow when ready.