# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

This is a freshly scaffolded `create-next-app` project (Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4). The only source files are the default `layout.tsx`, `page.tsx`, and `globals.css` — no custom routes, components, or business logic have been added yet. Treat existing files as a starting template, not established conventions to preserve.

## Commands

```bash
npm run dev      # start dev server (localhost:3000)
npm run build    # production build
npm run start    # serve production build
npm run lint     # eslint (flat config via eslint.config.mjs)
```

There is no test runner configured yet.

## Architecture

- App Router layout: source lives under `src/app/`, with `@/*` aliased to `./src/*` (see `tsconfig.json`).
- Styling is Tailwind CSS 4 using the CSS-first `@theme inline` config in `src/app/globals.css` (no `tailwind.config.js`) — extend the design system by adding CSS variables there, not a JS config file.
- `next.config.ts` and `eslint.config.mjs` (flat config extending `eslint-config-next`'s core-web-vitals and typescript rulesets) are both currently at their generated defaults.
