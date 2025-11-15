# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the React client; `src/main.tsx` bootstraps and `src/App.tsx` is the staging surface for UI work. Place feature modules in `src/components/<Feature>/` and colocate CSS or assets beside each component.
- `public/` holds static assets referenced directly from `index.html`.
- `worker/` hosts the Hono server and Durable Object agent code. `worker/index.ts` wires middleware/routes, while `worker/agents/image.ts` defines `ImageAgent` state and logic.
- Tooling lives at the repo root (`vite.config.ts`, `tsconfig.*`, `eslint.config.js`, `wrangler.jsonc`). Keep `wrangler.jsonc` and `worker-configuration.d.ts` in sync whenever bindings or migrations change.

## Build, Test, and Development Commands
- `npm install` installs dependencies.
- `npm run dev` starts Vite with hot reload and proxies Worker calls through Wrangler.
- `npm run lint` runs ESLint using the shared config and React Hook rules.
- `npm run build` type-checks (`tsc -b`) then emits the production bundle; run it before every commit.
- `npm run preview` serves the `dist/` build for manual QA.
- `npm run deploy` builds then pushes via `wrangler deploy`. Use `npx wrangler dev --local` for Worker-only debugging and `npm run cf-typegen` after binding edits.

## Coding Style & Naming Conventions
- Use TypeScript + JSX with 2-space indentation. Prefer function components, hooks, and colocated Tailwind utility classes or CSS modules per component.
- Components and Durable Object classes use `PascalCase`, hooks/utilities use `camelCase`, constants use `UPPER_SNAKE_CASE`, and filenames stay lowercase-dashed (`worker/agents/image.ts`).
- Follow ESLint output instead of disabling rules. Keep Worker handlers pure and small; delegate stateful logic to `ImageAgent` or future Durable Objects.

## Testing Guidelines
- There is no formal unit-test harness yet; the minimum regression gate is `npm run lint`, `npm run dev`, and `npx wrangler dev --local`.
- Document manual verification steps (e.g., hitting `/hello` or walking through the speech-to-image UI) inside the PR description.
- Add Vitest/UI or Worker smoke tests under `src/__tests__/` and `worker/__tests__/` whenever you add logic that can regress.

## Commit & Pull Request Guidelines
- Keep commits short, imperative, and in the style of the existing history (`Adds defaults`). Reference related issues in the body when extra context is needed.
- PRs need a summary, screenshots for UI changes, updated migration notes when Worker storage changes, and a checklist of commands executed.
- Request review only after `npm run build` succeeds locally and any configuration diffs—especially `wrangler.jsonc`—are explained in the description.
