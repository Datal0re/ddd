# AGENTS.md

## **Build/Lint/Test**

- Install deps: `npm ci`
- Lint: `npm run lint` (ESLint at root)
- Format: `npm run format` (Prettier at root)
- Test: `npm test`
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

## **Notes**

- Workspace is a git repo; commit via usual workflow.
