@AGENTS.md

# Wardrobr.ai — Claude Code Guide

## Project

AI-powered personal stylist. Users upload a photo or describe a style; Gemini 3 Flash uses function calling to search real products via Skimlinks, then returns a shoppable outfit board.

**Stack:** Next.js 14 App Router · TypeScript · Tailwind CSS · Gemini 3 Flash · Skimlinks · Zustand · Framer Motion

## Dev

```bash
cp .env.example .env.local   # fill in GEMINI_API_KEY at minimum
npm run dev                  # http://localhost:3000
```

## Key files

| Path | Purpose |
|---|---|
| `src/lib/gemini.ts` | Gemini model config, function declarations, system prompt |
| `src/lib/affiliate.ts` | Skimlinks product search + URL rewriting (server-only) |
| `src/lib/types.ts` | Shared TypeScript types |
| `src/store/chatStore.ts` | Zustand chat state |
| `src/app/api/style/route.ts` | Main POST endpoint — runs Gemini agentic loop |
| `src/app/api/products/route.ts` | Direct product search GET endpoint |
| `src/components/chat/` | ChatInterface, ChatMessage, ChatInput |
| `src/components/board/` | OutfitBoard, ProductCard |
| `src/components/upload/` | ImageUpload (react-dropzone) |

## Rules

- **Affiliate URLs must be rewritten server-side** — never pass raw product URLs to the client. Always go through `rewriteAffiliateUrl()` in the API route.
- **Never invent products** — Gemini must always call `search_products` before `build_outfit_board`.
- **Dark mode only** — the app is always dark; do not add light mode toggles.
- **UK-first** — default region is GB, currency GBP.
- Development uses mock product data when `SKIMLINKS_API_KEY` is not set.

## Phase roadmap

- **Phase 1 (now):** Image upload + text chat → outfit board, Skimlinks, UK-only, no auth
- **Phase 2:** Google OAuth, Supabase saved profiles, voice (Gemini Live), shareable board URLs
- **Phase 3:** US market, Awin integrations, SEO pages
- **Phase 4:** Mobile app, try-on preview

## gstack skills available

gstack is installed globally. Use these slash commands:

| Command | When to use |
|---|---|
| `/office-hours` | Strategic product/feature questions before building |
| `/plan-eng-review` | Lock architecture before implementing a new feature |
| `/review` | Code review before shipping |
| `/qa` | Browser-based QA after building a feature |
| `/cso` | Security audit (especially before affiliate link handling changes) |
| `/ship` | Bootstrap tests, open PRs |
