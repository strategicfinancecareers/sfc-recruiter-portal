# SFC Talent — Recruiter Portal

The SFC Talent platform: an anonymous candidate marketplace where recruiters
browse pre-vetted finance professionals and request warm introductions, and
candidates manage their own profile, résumé, and introduction responses.

## Stack

- **Vite** + **React** (TypeScript, SWC)
- **Tailwind CSS** + **shadcn/ui** (Radix primitives)
- **Supabase** — Postgres, Auth, Storage, Edge Functions
- **Vercel** — hosting + serverless API routes (`/api`)
- **Resend** — transactional email
- **Anthropic API** — résumé parsing + SFC Take generation

## Local development

Requires Node.js & npm (use [nvm](https://github.com/nvm-sh/nvm) if you like).

```sh
# Install dependencies
npm install

# Start the dev server (Vite, port 8080)
npm run dev

# Type-check + production build
npm run build

# Preview the production build locally
npm run preview
```

### Environment variables

Serverless functions in `/api` and the Supabase Edge Functions read secrets
from the environment (Vercel project settings / Supabase function secrets):

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — service-role DB access (server only)
- `RESEND_API_KEY` — transactional email (Resend)
- `ANTHROPIC_API_KEY` — résumé parsing / SFC Take
- Client-side: the public Supabase URL + anon key via the Vite `VITE_` prefix

Never commit real secrets. Service-role keys are used only in `/api` functions,
never in client code.

## Project layout

- `src/` — React app (pages, components, hooks, lib)
- `api/` — Vercel serverless functions (candidate/recruiter flows, intros, email)
- `supabase/` — migrations, config, and Edge Functions
- `public/` — static assets (favicon, brand logo, etc.)

## Deployment

Pushes to `main` deploy automatically via Vercel. Database changes are applied
through the migrations in `supabase/migrations/`.
