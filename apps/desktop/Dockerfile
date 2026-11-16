FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY angular.json ./angular.json
COPY apps/desktop/package.json apps/desktop/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY tsconfig.base.json ./
RUN npm ci --workspace apps/desktop --workspace packages/shared --include-workspace-root=false

COPY apps/desktop apps/desktop
COPY packages/shared packages/shared
RUN npm run build --workspace packages/shared && npm run build --workspace apps/desktop

FROM nginx:stable-alpine3.24
COPY apps/desktop/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/desktop/container-config.sh /docker-entrypoint.d/40-codetype-config.sh
RUN chmod +x /docker-entrypoint.d/40-codetype-config.sh
COPY --from=build /app/apps/desktop/dist/browser /usr/share/nginx/html
EXPOSE 80
