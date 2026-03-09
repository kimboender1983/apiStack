# APIForge

A headless CMS / API builder. Define collections, fields, and relations through an admin UI — the backend generates REST endpoints automatically.

## Monorepo structure

```
apiStack/
├── apiforge/       # NestJS + Fastify backend
└── admin/          # Vue 3 + Vite frontend (admin UI)
```

---

## Stack

| Layer | Tech |
|---|---|
| Backend | NestJS 11, Fastify, Prisma 6, PostgreSQL, Redis |
| Frontend | Vue 3, Vite, TypeScript, vue-i18n, TipTap |
| Auth | OTP via email (no passwords), JWT |
| Email | Resend HTTP API |
| Deployment | Railway (Docker for backend, Nixpacks for frontend) |

---

## Features

- **Projects** — multi-tenant, each project has its own collections and API keys
- **Collections** — define schema with typed fields (string, text, richtext, integer, float, boolean, date, datetime, json, enum, file)
- **Relations** — one_to_one, one_to_many, many_to_many between collections
- **Records** — CRUD with filtering, sorting, pagination, relation includes
- **API Keys** — scoped permissions (read/write/admin), rate limiting via Redis
- **Files / Media library** — upload to local disk or S3, used in record fields
- **Members / Team** — invite collaborators per project (editor/viewer roles) or workspace-wide
- **Export / Import** — JSON/CSV per collection, full project bundle with ID remapping
- **Localization** — UI in English, Dutch, German; preference saved per user
- **OTP login** — email one-time codes, no passwords

---

## Local development

### Prerequisites
- Node 20+
- PostgreSQL
- Redis

### Backend

```bash
cd apiforge
cp .env.example .env          # fill in DATABASE_URL, REDIS_URL, JWT_SECRET, RESEND_API_KEY, SMTP_FROM
npm install
npx prisma migrate dev
npm run start:dev
```

Runs on `http://localhost:3000`

### Frontend

```bash
cd admin
cp .env.example .env          # set VITE_API_URL=http://localhost:3000
npm install
npm run dev
```

Runs on `http://localhost:5173`

---

## Environment variables

### apiforge

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Secret for signing JWTs |
| `JWT_EXPIRY` | Token expiry, e.g. `7d` |
| `RESEND_API_KEY` | Resend API key for OTP emails |
| `SMTP_FROM` | Sender address, e.g. `noreply@yourdomain.com` |
| `NODE_ENV` | Set to `production` to send real emails |
| `PORT` | HTTP port (Railway sets this automatically) |

### admin

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend base URL, e.g. `https://your-api.up.railway.app` |

---

## Deployment (Railway)

Two services in one Railway project:

- **apiforge** — Dockerfile build, Docker service. Set root directory to `apiforge/`.
- **admin** — Nixpacks build, static site served with `serve`. Set root directory to `admin/`.

The backend runs Prisma migrations automatically on startup before the app starts.

---

## API overview

### Public API (requires API key header `Authorization: Bearer apf_...`)

```
GET    /api/:collection               List records (filter, sort, paginate, include)
GET    /api/:collection/:id           Get one record
POST   /api/:collection               Create record
PUT    /api/:collection/:id           Update record
DELETE /api/:collection/:id           Delete record
```

### Admin API (requires JWT `Authorization: Bearer <token>`)

```
POST   /auth/otp/request              Request OTP
POST   /auth/otp/verify               Verify OTP → returns JWT

GET    /admin/projects                List projects
POST   /admin/projects                Create project
DELETE /admin/projects/:id            Delete project

GET    /admin/projects/:id/collections
POST   /admin/projects/:id/collections
...and so on for fields, relations, records, api-keys, members, files, team
```

---

## License

UNLICENSED — private project.
