FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/desktop/package.json apps/desktop/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY tsconfig.base.json ./
COPY .env.example .env
RUN npm ci --workspace apps/server --workspace packages/shared --include-workspace-root=false --no-audit --no-fund \
  && npm cache clean --force

COPY apps/server apps/server
COPY packages/shared packages/shared
RUN DATABASE_URL="postgresql://codetype:codetype@localhost:5432/codetype" npm run db:generate --workspace apps/server
RUN npm run build --workspace packages/shared && npm run build --workspace apps/server

FROM build AS migrator
USER node
COPY --chown=node:node apps/server/start-migrations.sh ./start-migrations.sh
RUN chmod +x ./start-migrations.sh
CMD ["./start-migrations.sh"]

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && chown node:node /app

USER node
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node apps/desktop/package.json apps/desktop/package.json
COPY --chown=node:node apps/server/package.json apps/server/package.json
COPY --chown=node:node packages/shared/package.json packages/shared/package.json
RUN npm ci --omit=dev --omit=optional --workspace apps/server --workspace packages/shared --include-workspace-root=false --no-audit --no-fund \
  && npm cache clean --force

COPY --from=build --chown=node:node /app/apps/server/dist apps/server/dist
COPY --from=build --chown=node:node /app/packages/shared/dist packages/shared/dist
COPY --from=build --chown=node:node /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=node:node apps/server/start-container.sh ./start-container.sh
RUN chmod +x ./start-container.sh
EXPOSE 3001
CMD ["./start-container.sh"]
