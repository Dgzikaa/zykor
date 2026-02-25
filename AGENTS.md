# AGENTS.md

## Cursor Cloud specific instructions

### Project Overview

Zykor / SGB v2 is a bar management system (Next.js 15 + Supabase). The main application lives in `frontend/`. Backend consists of Supabase Edge Functions in `backend/` (Deno-based, deployed to Supabase cloud).

### Running the Frontend

```bash
cd /workspace/frontend
npm run dev        # starts on port 3001
```

The dev server runs on **port 3001** (not the default 3000). See `package.json` scripts for all available commands.

### Key Commands

| Task | Command | Working Directory |
|------|---------|-------------------|
| Dev server | `npm run dev` | `frontend/` |
| Lint | `npx next lint` | `frontend/` |
| Type check | `npm run type-check` | `frontend/` |
| Build | `npm run build` | `frontend/` |
| Format | `npm run format` | `frontend/` |

### Environment Variables

The app connects to a remote Supabase instance (project ID: `uqtgsvujwcbymjmvkjhy`). The Supabase URL and anon key are hardcoded as fallbacks in `src/lib/supabase.ts`, so the dev server starts without `.env.local`. For full functionality (auth, data operations), a `.env.local` file with valid `SUPABASE_SERVICE_ROLE_KEY` is needed.

### Environment Setup for Login

The `SUPABASE_SERVICE_ROLE_KEY` secret must be added to `frontend/.env.local` for auth to work. The dev server must be restarted after changing `.env.local`. Login credentials are available as `TEST_LOGIN_EMAIL` and `TEST_LOGIN_PASSWORD` secrets.

### Gotchas

- **`postinstall` script**: `npm install` runs `node patch-watchpack.js` which patches Next.js Watchpack to suppress Windows filesystem errors. This is harmless on Linux.
- **TypeScript errors are ignored during build** (`ignoreBuildErrors: true` in `next.config.js`), but `npm run type-check` runs cleanly.
- **ESLint has pre-existing warnings/errors** in the codebase (mostly `react-hooks/exhaustive-deps` and `jsx-a11y` warnings). `next lint` exits with code 1 due to a few `react/no-unescaped-entities` errors.
- **Login requires a real Supabase account**. Without `SUPABASE_SERVICE_ROLE_KEY`, the login API returns a server error. The UI still loads and is interactive.
- **Login via browser vs curl**: The login may fail when tested with `curl` directly against the API but succeed through the browser UI. Use the browser for login testing.
- The `.cursorrules` file references Windows/PowerShell conventions — ignore these on Linux cloud environments. Use standard Unix commands.
