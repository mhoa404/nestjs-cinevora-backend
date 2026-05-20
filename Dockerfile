FROM node:22-alpine AS base

RUN apk add --no-cache python3 make g++ dumb-init
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile


FROM base AS build

WORKDIR /app

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src/ ./src/

RUN pnpm build

RUN pnpm prune --prod

FROM node:22-alpine AS production

RUN apk add --no-cache dumb-init

LABEL maintainer="Cinevora Team" \
    org.opencontainers.image.title="Cinevora Backend" \
    org.opencontainers.image.description="NestJS backend API for Cinevora" \
    org.opencontainers.image.vendor="Cinevora" \
    org.opencontainers.image.source="https://github.com/mhoa404/nestjs-cinevora-backend"

ENV NODE_ENV=production

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

RUN chown -R node:node /app

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD ["node", "-e", " \
    const http = require('http'); \
    const options = { hostname: '127.0.0.1', port: process.env.PORT || 3000, timeout: 5000 }; \
    const req = http.request(options, (res) => { \
    process.exit(res.statusCode === 200 || res.statusCode === 404 ? 0 : 1); \
    }); \
    req.on('error', () => process.exit(1)); \
    req.on('timeout', () => { req.destroy(); process.exit(1); }); \
    req.end(); \
    "]

EXPOSE 3000

USER node

# Use dumb-init as PID 1 to handle signals properly
# This ensures SIGTERM is forwarded to the Node.js process for graceful shutdown
ENTRYPOINT ["dumb-init", "--"]

# Start the NestJS application
CMD ["node", "dist/main.js"]
