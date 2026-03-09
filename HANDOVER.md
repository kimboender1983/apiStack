# Session Handover

Use this file to resume a Claude Code session for the APIForge project.

---

## How to resume

Open Claude Code in `/Users/kimboender/dev/own/claude/apiStack` and say:

> "Resume work on APIForge. Read HANDOVER.md for context."

---

## Where we left off (2026-03-09)

The app is deployed and working on Railway. The last features built were:

1. **Export / Import** — collection (JSON/CSV) and full project bundle with ID remapping
2. **Localization (vue-i18n)** — EN, NL, DE; language switcher in sidebar; saved to localStorage + user profile

---

## Deployment status

| Service | Platform | URL |
|---|---|---|
| Backend (apiforge) | Railway / Docker | `https://apistack-production.up.railway.app` |
| Frontend (admin) | Railway / Nixpacks | `https://apistack-production-abe1.up.railway.app` |

**Railway project**: `apiStack` — two services (apiforge + admin) from the same GitHub repo `kimboender1983/apiStack`.

### Known deployment details
- Backend target port must be **8080** in Railway networking settings (Railway auto-sets `PORT=8080`)
- `VITE_API_URL` must be set to `https://apistack-production.up.railway.app` in the admin service
- After changing `VITE_API_URL`, admin service must be **redeployed** (Vite bakes it at build time)
- Email: uses Resend HTTP API (`RESEND_API_KEY` env var); SMTP ports are blocked by Railway
- Login only works in production with `NODE_ENV=production` and a valid `RESEND_API_KEY`

---

## Open items / next steps

- [ ] Verify Resend domain is set up for sending to real email addresses (currently limited to `kimboender1983@gmail.com`)
- [ ] Set up custom domain for Railway services (optional)
- [ ] Add `.env.example` files for both apiforge and admin
- [ ] The `uploads/` directory is local to the Railway container — files are lost on redeploy. Hook up S3 properly for production file storage (the code already has `@aws-sdk/client-s3` installed, just needs config)

---

## Architecture quick reference

- `apiforge/prisma/schema.prisma` — full DB schema
- `apiforge/src/modules/` — NestJS feature modules (auth, projects, collections, fields, relations, records, api-keys, uploads, files, members, team, export-import, users)
- `admin/src/views/` — Vue page components
- `admin/src/api/client.ts` — all API calls in one file
- `admin/src/i18n/locales/` — translation files (en.ts, nl.ts, de.ts)
- `admin/src/stores/auth.ts` — auth state (JWT, user profile)

## Key patterns / gotchas

- Records stored as JSONB in `records.data` — relation field values are IDs stored alongside regular field values
- API keys use `apf_` prefix + 32 random bytes (base64url), stored as argon2 hash
- JWT `expiresIn` must be cast to template literal type e.g. `'7d' as \`${number}d\``
- NestJS with Fastify: CORS registered on the adapter BEFORE `NestFactory.create()` with `strictPreflight: false`
- NestJS build output: `dist/src/main.js` (not `dist/main.js`) because `sourceRoot: "src"` in nest-cli.json
- `@fastify/cors` plugin registered via `adapter.getInstance().register(cors, { strictPreflight: false })` BEFORE NestFactory.create()
- Prisma 6: `Prisma.JsonNull` removed — use `null as any`; `Prisma.InputJsonValue` removed — use `any`

---

## Repo

GitHub: `https://github.com/kimboender1983/apiStack`
Branch: `main`
