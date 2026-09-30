# Onboardie

AI onboarding coach for new hires at German Mittelstand companies: a **New Hire** portal (dashboard, AI coach, learning plan, resources, contacts) and a **Manager** portal (upload, review & approve, manage content, insights).

This site also serves the **Prototype Testing Guide** at [`/testing-guide/`](public/testing-guide/index.html).

Stack: TanStack Start (React 19, Vite, SSR), Tailwind CSS v4 + shadcn/ui, Supabase (Postgres, Auth, RLS), any OpenAI-compatible AI API, optional Notion. Architecture details are in [REBUILD-BRIEFING.md](REBUILD-BRIEFING.md).

## Setup

You need Node.js 22+, a Supabase project, and an API key from an AI provider.

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the database schema. Either run the files in `supabase/migrations/` **in filename order** in the SQL Editor, or use the CLI:
   ```sh
   npx supabase link --project-ref YOUR-PROJECT-REF
   npx supabase db push
   ```
3. Go to **Authentication → URL Configuration**. Set **Site URL** to your live URL (e.g. `https://onboardie.netlify.app`). Add `http://localhost:8080/**` and `https://YOUR-SITE/**` to **Redirect URLs**.
4. Copy the URL, publishable (anon) key and secret (service role) key from **Project Settings → API**.

### 2. Environment variables

Copy `.env.example` to `.env` and fill it in. Each variable is explained in that file.

| Variable | Needed for |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` | Everything |
| `SUPABASE_SERVICE_ROLE_KEY` | Coach insights, company updates, AI failure log |
| `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | AI coach, "Structure This", question topics |
| `NOTION_API_KEY` | Optional: shared read-only mockup roles |

### 3. Run locally

```sh
npm install
npm run dev        # http://localhost:8080
```

## Deploy to Netlify

1. In Netlify, choose **Add new site → Import an existing project** and pick this repository. `netlify.toml` already sets the build command (`npm run build`) and the publish folder (`dist`).
2. Add the environment variables from step 2 under **Site configuration → Environment variables**. The `VITE_` values are baked in at build time, so trigger a new deploy after changing them.
3. Deploy. The app is served from `/` and the testing guide from `/testing-guide/`.

**Other hosts.** The server is built with [Nitro](https://nitro.build), which detects Netlify, Vercel and Cloudflare on its own. For a VM or Docker, run `NITRO_PRESET=node-server npm run build` and then `npm start` (listens on `PORT`, default 3000).

## Moving data from Lovable Cloud

The Lovable prototype used a Supabase database managed by Lovable. A new Supabase project starts empty. If you want to keep the prototype's companies, users and content, export the tables from the Lovable Cloud backend and import them into your new project after running the migrations. Otherwise, just sign up again in the new app.

## MCP server (optional)

`/mcp` exposes two tools, `get_role_content` and `ask_onboarding_coach`, for AI clients such as Claude. It authenticates with Supabase's OAuth 2.1 server. To use it, enable the OAuth server in Supabase (**Authentication → OAuth Server**) and set its authorization path to `/oauth/consent`. The tools read the Notion mockup content, so they also need `NOTION_API_KEY`.

## Scripts

- `npm run dev`: start the dev server
- `npm run build`: production build
- `npm run typecheck`: TypeScript check
- `npm run lint` / `npm run format`: ESLint / Prettier
