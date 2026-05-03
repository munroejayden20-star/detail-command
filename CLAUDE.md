# Detail Command — Project Instructions

## Session Startup

On every new conversation, read these files in order:

1. [project-context.md](project-context.md) — app overview, features, tables, RPCs
2. [roadmap.md](roadmap.md) — project phases, current work, planned features
3. [current-task.md](current-task.md) — the specific task(s) to work on
4. [architecture-notes.md](architecture-notes.md) — tech stack, structure, data flow

After reading these, **wait for the user's instruction** before taking any action.

---

## Project Overview

**Detail Command** is a mobile auto detailing business management PWA built for Jayden's Mobile Detailing.

- **Owner:** Jayden (jaydensmobiledetailing03@gmail.com)
- **Frontend:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui
- **Backend:** Supabase (Postgres + Auth + Storage)
- **Deployment:** Vercel

### Key Rules

1. Supabase is the source of truth — never use localStorage for business data.
2. Every user-owned table has `user_id` with RLS enabled.
3. Public booking page (`/book`) must not expose private keys — use anon-callable SECURITY DEFINER RPCs.
4. Timezone is America/Los_Angeles for all scheduling.
5. Booking photos go to the public `booking-uploads` bucket; dashboard photos go to the private `photos` bucket.
6. Service area is Vancouver, WA / Portland, OR metro.

---

## Common Commands

```bash
npm run dev        # local dev server (port 5173)
npm run build      # TypeScript check + Vite build
npm run lint       # TypeScript type check only
```

---

## Working Style

- **Direct, no fluff.** Tell the user what changed and why.
- **No rebuilds.** Preserve existing data and behavior unless explicitly told to change it.
- **Phase-based.** Work follows the roadmap phases; features ship incrementally.
- **Test in the browser.** For UI/frontend changes, start the dev server and test the feature before reporting completion.
