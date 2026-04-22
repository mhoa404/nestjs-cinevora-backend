# FILE: Dockerfile

path: Dockerfile
module: root
kind: file
language: dockerfile
line_count: 38
size_bytes: 725
sha256: b504f66c50ebb067ee3730c124acbb8f1ea7e0f1226f18f816eb45a8fc548284
updated_at: 2026-04-08T04:57:37.324Z

## SYMBOLS
- (none detected)

## CODE

````dockerfile
FROM node:22-bookworm-slim AS base

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

FROM base AS deps

COPY package.json ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --no-frozen-lockfile

FROM deps AS builder

COPY . .
RUN pnpm build
RUN pnpm prune --prod

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

CMD ["sh", "-c", "pnpm migration:run:prod && node dist/main"]
````
