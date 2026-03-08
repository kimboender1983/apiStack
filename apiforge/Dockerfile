FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

# ── Production image ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# Prisma client needs the schema to generate
COPY prisma ./prisma
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

# Ensure upload directory exists (for local/fallback use)
RUN mkdir -p uploads

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy; node dist/main"]
