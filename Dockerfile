# Single image used for both `web` and `worker` (different commands in compose).
FROM node:22-slim AS build
WORKDIR /app

# System deps for sharp are bundled as prebuilt binaries; no extra apt needed.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build needs env present, but values are irrelevant at build time.
RUN DATABASE_URL=postgres://x AUTH_SECRET=buildsecret \
    S3_BUCKET=x USERS='[{"username":"a","passwordHash":"h","role":"admin"}]' \
    npm run build

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

# Default command is overridden per-service in docker-compose.
CMD ["sh", "scripts/start-web.sh"]
