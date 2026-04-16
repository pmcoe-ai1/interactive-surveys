# Sprint 1 — Outstanding Fixes

## Auth Not Working (S8.1, S8.2)

UI is built. Backend code is written. But none of the 3 sign-in methods work because environment variables are missing in Railway.

### Missing Railway Variables

| Variable | Purpose | Status |
|----------|---------|--------|
| `EMAIL_SERVER` | SMTP connection string for magic link emails | NOT SET |
| `EMAIL_FROM` | Sender email address for magic links | NOT SET |
| `GITHUB_ID` | GitHub OAuth App client ID | NOT SET |
| `GITHUB_SECRET` | GitHub OAuth App client secret | NOT SET |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | NOT SET |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | NOT SET |

### What Needs to Happen

1. Create a GitHub OAuth App at github.com/settings/developers
   - Callback URL: `https://interactive-surveys-production.up.railway.app/api/auth/callback/github`
2. Create a Google OAuth App at console.cloud.google.com
   - Callback URL: `https://interactive-surveys-production.up.railway.app/api/auth/callback/google`
3. Set up SMTP (e.g. Resend, SendGrid, or Gmail SMTP)
4. Add all 6 variables to Railway

### Currently Set (Working)

- `DATABASE_URL` — connected to Railway Postgres
- `NEXTAUTH_SECRET` — set
- `NEXTAUTH_URL` — set
- `PORT` — set

## Workflow Pipeline Bugs

| # | Bug | Fix |
|---|-----|-----|
| 1 | Push fails silently (`continue-on-error: true`) | Remove `continue-on-error`, fail the job if push fails |
| 2 | No `npm ci` verification after coding agent writes code | Add verification step before artifact upload |
| 3 | No pinned dependency versions — coding agent invents them | Commit a base `package.json` with compatible versions |
| 4 | Testing agent `npm ci` failure treated as agent failure | Add pre-flight check that routes back to coding agent |
| 5 | No checkpoint written on failure | Add checkpoint step after each job |
| 6 | Artifact is the only copy of code if push fails | Make push mandatory |
| 7 | `package.json` missing `scripts` block | Add `dev`, `build`, `start`, `test` scripts |

## Test Results (Run #6)

- 61 tests total: 58 passed, 3 failed
- Failures: `/health` returns 503, missing `scripts` in package.json, missing `dev` script
