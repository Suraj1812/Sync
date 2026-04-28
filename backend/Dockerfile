FROM node:22-alpine AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY backend backend
RUN pnpm --filter backend prisma:generate && pnpm --filter backend build

FROM base AS runtime
ENV NODE_ENV=production
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY backend/package.json backend/package.json
RUN pnpm install --frozen-lockfile --prod --filter backend
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/prisma backend/prisma
COPY backend/docker-entrypoint.sh backend/docker-entrypoint.sh
RUN chmod +x backend/docker-entrypoint.sh
EXPOSE 4000
ENTRYPOINT ["backend/docker-entrypoint.sh"]
CMD ["pnpm", "--filter", "backend", "start:prod"]
