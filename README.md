# Clypa

Clypa is a niche-bending platform for short-form video creators. It finds proven viral
faceless niches on TikTok, reverse-engineers why they work, and bends the winning formula
into a creator's own topic — then produces ready-to-film scripts from it.

The loop: **Find** a viral faceless niche → **Understand** it (transcripts + SOP) →
**Bend** it into your own niche → **Produce** scripts from the bent SOP.

This repo contains the frontend: the marketing landing page (`/`) and the authenticated
in-app dashboard (`/app`).

## Tech stack

- **Next.js 16** (App Router), **React 19**, **TypeScript**
- **Tailwind CSS 4**, configured CSS-first via `@theme inline` in `src/app/globals.css` —
  there is no `tailwind.config.js`. Design tokens (colors, radii, shadows) live there as
  CSS variables and are exposed as Tailwind utilities (`bg-primary`, `text-body`,
  `rounded-card`, etc.).
- **lucide-react** for icons.
- No auth — the app fakes a logged-in user, `Zengo` (`src/lib/mock/user.ts`).

## Local development

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint
```

`src/app/api/bend/route.ts` (see below) calls Cloudflare Workers AI and needs
`CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in `.env.local` to work. Without them,
the Niche Bending flow (`/app/bend`) will show its error state — every other page works
with no environment setup at all.

## Project structure

```
src/
├── app/
│   ├── page.tsx                 # marketing landing page (/)
│   ├── layout.tsx, globals.css  # root layout, fonts, design tokens
│   ├── api/bend/route.ts        # real Cloudflare Workers AI route (used by /app/bend)
│   └── app/                     # nested route folder → URL prefix /app (dashboard)
│       ├── layout.tsx           # Sidebar + TopBar shell
│       ├── page.tsx             # dashboard home
│       ├── bend/                # flagship Niche Bending flow
│       ├── niches/, sops/, scripts/, transcripts/, library/,
│       │   collections/, agents/, settings/ (+ settings/api/)
│       └── */_components/       # page-only components used nowhere else
├── components/
│   ├── ui/          # primitives: Button, Badge, Card, LinkInput, EmptyState, Avatar,
│   │                  Accordion, CodeSnippet, Table, Tabs
│   ├── features/    # NicheCard, SopView, ScriptView, TranscriptView, AgentCard,
│   │                  and features/bend/ (BendFlow + its sub-steps)
│   ├── pricing/      # PricingCard, PricingTable, PricingComparisonTable
│   │                  (shared between the landing pricing section and /app/settings)
│   ├── landing/      # Nav, Hero, LoopSteps, NicheBendingSpotlight, FeatureGrid,
│   │                  FeatureRow, PricingSection, DeveloperBand, Faq, Footer
│   └── dashboard/    # Sidebar, TopBar, ActionCard, PromoCard, ToolTile, StreakBanner
└── lib/
    ├── types.ts      # every shared TypeScript interface
    ├── utils.ts      # cn(), formatNumber(), formatDate()
    ├── mock-data.ts  # barrel — import mock data and types from here
    └── mock/*.ts     # one file per data domain (niches, sops, scripts, ...)
```

`src/app/app/` is an ordinary nested route folder that produces the `/app` URL prefix —
it isn't a special Next.js directory name, just a naming coincidence with the outer
`src/app/` App Router convention folder.

## Design tokens

Source of truth: `src/app/globals.css`.

| Token | Value | Utility |
|---|---|---|
| `--color-primary` | `#335cff` | `bg-primary`, `text-primary`, `border-primary` |
| `--color-accent` | `#eef0ff` | `bg-accent`, `text-accent` |
| `--color-heading` | `#0b0f19` | `text-heading`, `bg-heading` |
| `--color-body` | `#6b7280` | `text-body` |
| `--color-hairline` | `#e5e7eb` | `border-hairline` |
| `--color-app` | `#f7f8fa` | `bg-app` (dashboard shell background) |
| `--color-surface` | `#ffffff` | `bg-surface` (card background) |
| `--radius-card` / `--radius-card-sm` / `--radius-chip` | `20px` / `16px` / `12px` | `rounded-card`, `rounded-card-sm`, `rounded-chip` |
| `--shadow-card` / `--shadow-card-hover` | flat hairline shadows | `shadow-card`, `shadow-card-hover` |

Font is Inter, loaded once in `src/app/layout.tsx` (weights 400/600) and applied globally
via `font-sans`.

## Mock data

Every page renders from typed mock data in `src/lib/mock/*.ts`, re-exported through the
`src/lib/mock-data.ts` barrel — import everything (types and data) from that one file:

```ts
import { NICHES, MOCK_USER, type Niche } from "@/lib/mock-data";
```

Each domain file maps to a future REST resource: `niches.ts` → `GET /niches`,
`sops.ts` → `GET /sops`, `scripts.ts` → `GET /scripts`, `transcripts.ts` → `GET /transcripts`,
`library.ts` → `GET /library`, `collections.ts` → `GET /collections`, `agents.ts` → `GET /agents`,
`pricing.ts` / `api-keys.ts` → billing and API-key management endpoints.

## Wiring to a real API

**`/app/bend` already calls a real backend.** `src/app/api/bend/route.ts` predates this
build-out and calls Cloudflare Workers AI directly. `BendFlow`
(`src/components/features/bend/BendFlow.tsx`) does a real
`fetch("/api/bend", { method: "POST", body: { sourceNiche, targetNiche } })`, handles the
loading and error states, and renders whatever comes back. The `NicheBendSOP` /
`NicheBendResult` types in `src/lib/types.ts` intentionally mirror the route's response
shape field-for-field.

Because the underlying LLM call isn't schema-validated server-side, its JSON output
doesn't always match the declared shape exactly (e.g. `structure` or `scripts` entries
can come back as nested objects instead of plain strings). `normalizeBendResult.ts` in
the same folder coerces whatever comes back into displayable strings before it hits the
UI — keep that in place (or replace it with real server-side validation) if you swap the
model or prompt.

Every other route is mock-only. To wire one up for real: replace the corresponding
`lib/mock/*.ts` import with a `fetch` call (or a server-side data fetch in the page
component), keeping the same TypeScript types from `lib/types.ts` so the components
underneath don't need to change. The public landing page's Niche Bending spotlight
(`NicheBendingSpotlight`, adapted from the original `NicheBenderHero` component) is
deliberately kept fully mocked, even after wiring `/app/bend` — it's unauthenticated, and
letting anonymous visitors trigger a real paid LLM call on every page load is out of scope.

## Known gaps

- No real authentication — `MOCK_USER` ("Zengo") is hardcoded.
- No persistence — nothing written by the UI is saved anywhere.
- The sidebar's ⌘K search box is a static visual, not a functional command palette.
- Whop billing in `/app/settings` is a mock — no real billing provider is connected.
- The MCP tab in `/app/settings/api` shows a static config snippet; there's no real MCP
  server yet.
- `/app/scripts`'s "Generate" cycles through mock scripts rather than calling a model.
